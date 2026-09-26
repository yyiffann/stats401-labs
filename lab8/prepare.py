"""
Prepare data for Lab 8.

From the stats401-labs root, repair the existing CSV files with:

python3 lab8/prepare.py data/lab8/V2021-22_DKU_UG_Bulletin.pdf --repair-sections

To run the entire analysis again, omit --repair-sections.
"""

import argparse
import re
from bisect import bisect_right
from pathlib import Path

import numpy as np
import pandas as pd
import pymupdf
import umap
from sentence_transformers import SentenceTransformer
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


OUT = Path(__file__).resolve().parent.parent / "data" / "lab8"

HEADING = re.compile(
    r"^(Part\s+\d+\s*:\s*.+|Chapter\s+\d+\s*[:.]?\s*.+)$",
    re.I,
)

COURSE = re.compile(r"^[A-Z]{2,8}\s*\d{3}[A-Z]?\s*[.:-]")


def clean(text):
    return re.sub(
        r"\s+",
        " ",
        text.replace("\u00ad", ""),
    ).strip()


def outline_states(doc):
    """Record the document hierarchy at each PDF outline position."""
    events = []

    for level, title, page, destination in doc.get_toc(simple=False):
        point = destination.get("to")

        if page >= 1 and point is not None:
            events.append(
                (page, float(point.y), level, title.strip())
            )

    events.sort(key=lambda item: (item[0], item[1]))

    positions = []
    states = []
    headings = []

    for page, y, level, title in events:
        headings = [
            heading
            for heading in headings
            if heading[0] < level
        ]
        headings.append((level, title))

        positions.append((page, y))
        states.append(headings.copy())

    return positions, states


def hierarchy_at(page_number, y, positions, states):
    """Find the chapter and section above a text block."""
    index = bisect_right(positions, (page_number, y)) - 1
    headings = states[index] if index >= 0 else []

    chapter = next(
        (title for level, title in headings if level == 1),
        "Front matter",
    )

    section = next(
        (title for level, title in headings if level == 2),
        chapter,
    )

    subsection = next(
        (title for level, title in headings if level >= 3),
        "",
    )

    return chapter, section, subsection


def extract(pdf_path):
    """Extract passages with their PDF hierarchy and page number."""
    doc = pymupdf.open(pdf_path)
    positions, states = outline_states(doc)

    print("PDF pages:", len(doc))
    print("Outline entries:", len(positions))

    rows = []
    raw_blocks = 0

    for page_index, page in enumerate(doc):
        # Skip cover pages and the table of contents.
        if page_index < 9:
            continue

        for block in page.get_text("blocks", sort=True):
            text = clean(block[4])
            raw_blocks += 1

            if (
                len(text) < 70
                or text.isdigit()
                or re.search(r"\.{5,}\s*\d+$", text)
                or HEADING.fullmatch(text)
                or COURSE.match(text)
            ):
                continue

            chapter, section, subsection = hierarchy_at(
                page_index + 1,
                block[1],
                positions,
                states,
            )

            if len(text) > 2200:
                sentences = re.split(
                    r"(?<=[.!?])\s+(?=[A-Z])",
                    text,
                )

                chunks = []
                current = ""

                for sentence in sentences:
                    if len(current) + len(sentence) > 1000 and current:
                        chunks.append(current)
                        current = ""

                    current = (current + " " + sentence).strip()

                if current:
                    chunks.append(current)
            else:
                chunks = [text]

            for passage in chunks:
                if len(passage) >= 70:
                    rows.append({
                        "chapter": chapter,
                        "section": section,
                        "subsection": subsection,
                        "page_pdf": page_index + 1,
                        "text": passage,
                    })

    return raw_blocks, pd.DataFrame(rows)


def repair_sections(pdf_path):
    """
    Correct section metadata in the existing passage CSV.

    Preserve passage IDs, text, topics, UMAP coordinates,
    and semantic neighbors. Then rebuild the matrix CSV.
    """
    doc = pymupdf.open(pdf_path)
    positions, states = outline_states(doc)

    passage_path = OUT / "lab8_embedding_map.csv"
    df = pd.read_csv(passage_path)

    page_blocks = {}
    unmatched = []
    ambiguous = []

    for row_index, row in df.iterrows():
        page_number = int(row.page_pdf)

        if page_number not in page_blocks:
            page = doc[page_number - 1]

            page_blocks[page_number] = [
                (block[1], clean(block[4]))
                for block in page.get_text("blocks", sort=True)
            ]

        passage = clean(row.text)
        prefix = passage[:min(70, len(passage))]

        matches = [
            y
            for y, content in page_blocks[page_number]
            if prefix in content
        ]

        # A few course-title blocks include a course code
        # that is not in the PDF text block itself.
        if not matches and len(passage) > 40:
            suffix = passage[-min(50, len(passage)):]

            matches = [
                y
                for y, content in page_blocks[page_number]
                if suffix in content
            ]

        if not matches:
            unmatched.append(row.passage_id)
            continue

        if len(matches) > 1:
            full_matches = [
                y
                for y, content in page_blocks[page_number]
                if passage in content
            ]

            if full_matches:
                matches = full_matches

            if len(matches) > 1:
                ambiguous.append(row.passage_id)

        chapter, section, subsection = hierarchy_at(
            page_number,
            matches[0],
            positions,
            states,
        )

        df.loc[
            row_index,
            ["chapter", "section", "subsection"],
        ] = [chapter, section, subsection]

    if unmatched:
        raise ValueError(
            f"Passages could not be matched; CSV not changed: "
            f"{unmatched[:20]}"
        )

    matrix = (
        df.groupby(["section", "cluster_name"], as_index=False)
        .size()
        .rename(columns={"size": "count"})
    )

    df.to_csv(
        passage_path,
        index=False,
    )

    matrix.to_csv(
        OUT / "lab8_topic_section_matrix.csv",
        index=False,
    )

    print("Updated passages:", len(df))
    print("Formal sections:", df["section"].nunique())
    print("Repeated-text matches:", len(ambiguous))


def main(pdf_path):
    OUT.mkdir(exist_ok=True)

    raw_blocks, df = extract(pdf_path)

    if df.empty:
        raise ValueError("No passages were extracted from the PDF.")

    df = df.drop_duplicates("text").reset_index(drop=True)

    df.insert(
        0,
        "passage_id",
        [f"p{i:05d}" for i in range(1, len(df) + 1)],
    )

    df["word_count"] = df["text"].str.split().str.len()

    print("Raw PDF text blocks:", raw_blocks)
    print("Clean passages:", len(df))
    print("Mean words:", round(df["word_count"].mean(), 1))
    print("Formal sections:", df["section"].nunique())

    model = SentenceTransformer("all-MiniLM-L6-v2")

    embeddings = model.encode(
        df["text"].tolist(),
        normalize_embeddings=True,
        show_progress_bar=True,
    )

    n_clusters = min(8, max(2, len(df) // 20))

    labels = KMeans(
        n_clusters=n_clusters,
        random_state=401,
        n_init=10,
    ).fit_predict(embeddings)

    df["cluster"] = labels

    coordinates = umap.UMAP(
        n_components=2,
        n_neighbors=15,
        min_dist=0.15,
        metric="cosine",
        random_state=401,
    ).fit_transform(embeddings)

    df["x"] = coordinates[:, 0]
    df["y"] = coordinates[:, 1]

    tfidf = TfidfVectorizer(
        stop_words="english",
        min_df=2,
        max_df=0.85,
        ngram_range=(1, 2),
    )

    tfidf_matrix = tfidf.fit_transform(df["text"])
    terms = np.array(tfidf.get_feature_names_out())

    for cluster_id in range(n_clusters):
        indices = np.flatnonzero(labels == cluster_id)

        mean_tfidf = np.asarray(
            tfidf_matrix[indices].mean(axis=0)
        ).ravel()

        top_terms = terms[
            np.argsort(mean_tfidf)[-8:][::-1]
        ]

        center = embeddings[indices].mean(axis=0)

        representative_indices = indices[
            np.argsort(embeddings[indices] @ center)[-3:][::-1]
        ]

        print(
            "\nCLUSTER",
            cluster_id,
            "TERMS:",
            ", ".join(top_terms),
        )

        for index in representative_indices:
            print(
                df.iloc[index]["passage_id"],
                df.iloc[index]["section"],
                df.iloc[index]["text"][:300],
            )

    # Labels checked against the clusters in the current CSV.
    names = {
        0: "Environment, health and policy",
        1: "Academic rules and student status",
        2: "Writing, media and research",
        3: "Natural sciences and technology",
        4: "Global history and society",
        5: "University programs and transfer",
        6: "Course credits and degree requirements",
        7: "China and Chinese studies",
    }

    df["cluster_name"] = df["cluster"].map(names)

    similarity = cosine_similarity(embeddings)
    nearest_ids = []

    for row_index in range(len(df)):
        candidate_indices = np.argsort(
            similarity[row_index]
        )[-6:][::-1]

        neighbors = [
            df.iloc[index]["passage_id"]
            for index in candidate_indices
            if index != row_index
        ]

        nearest_ids.append("|".join(neighbors))

    df["neighbor_ids"] = nearest_ids

    df.to_csv(
        OUT / "lab8_embedding_map.csv",
        index=False,
    )

    matrix = (
        df.groupby(["section", "cluster_name"], as_index=False)
        .size()
        .rename(columns={"size": "count"})
    )

    matrix.to_csv(
        OUT / "lab8_topic_section_matrix.csv",
        index=False,
    )

    print("Saved two CSV files in", OUT)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument(
        "--repair-sections",
        action="store_true",
        help="Repair section metadata in existing CSVs without rerunning embeddings.",
    )

    args = parser.parse_args()

    if args.repair_sections:
        repair_sections(args.pdf)
    else:
        main(args.pdf)