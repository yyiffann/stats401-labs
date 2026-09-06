import pandas as pd
from transformers import pipeline


# =========================
# 1. Load data
# =========================

df = pd.read_csv("data/twitter_chatgpt.csv")

print("Original shape:", df.shape)


# =========================
# 2. Randomly sample 1,000 tweets
# =========================

df = df.sample(
    n=1000,
    random_state=42
).reset_index(drop=True)

print("Sampled shape:", df.shape)


# =========================
# 3. Keep needed columns
# =========================

columns_to_keep = [
    "ID",
    "Date",
    "Tweet",
    "ReplyCount",
    "RetweetCount",
    "LikeCount",
    "QuoteCount"
]

df = df[columns_to_keep]

print("Sampled shape:", df.shape)


# =========================
# 4. Data quality checks
# =========================

print("\n--- Missing Values ---")
print(df.isnull().sum())

print("\n--- Duplicate Rows ---")
print("Duplicate rows:", df.duplicated().sum())

print("\n--- Duplicate IDs ---")
print("Duplicate IDs:", df["ID"].duplicated().sum())

print("\n--- Negative Values ---")
print("Negative ReplyCount:", (df["ReplyCount"] < 0).sum())
print("Negative RetweetCount:", (df["RetweetCount"] < 0).sum())
print("Negative LikeCount:", (df["LikeCount"] < 0).sum())
print("Negative QuoteCount:", (df["QuoteCount"] < 0).sum())

print("\n--- Date Check ---")

df["Date"] = pd.to_datetime(
    df["Date"],
    errors="coerce"
)

print("Invalid dates:", df["Date"].isna().sum())

print("\n--- Empty Tweets ---")
print(
    "Empty tweets:",
    (df["Tweet"].str.strip() == "").sum()
)


# =========================
# 5. Remove invalid records
# =========================

df = df.dropna(
    subset=["Date", "Tweet"]
)

df = df[
    df["Tweet"].str.strip() != ""
]


# =========================
# 6. Prepare text for RoBERTa
# =========================

texts = df["Tweet"].astype(str).tolist()


# =========================
# 7. RoBERTa sentiment analysis
# =========================

print("\nLoading RoBERTa sentiment model...")

sentiment_model = pipeline(
    "sentiment-analysis",
    model="cardiffnlp/twitter-roberta-base-sentiment-latest",
    top_k=None
)

print("Running sentiment analysis...")

results = sentiment_model(
    texts,
    batch_size=16
)


# =========================
# 8. Extract sentiment
# =========================

sentiments = []
sentiment_scores = []

for result in results:

    scores = {
        item["label"].lower(): item["score"]
        for item in result
    }

    positive = scores.get("positive", 0)
    negative = scores.get("negative", 0)

    sentiment = max(
        scores,
        key=scores.get
    )

    sentiment_score = positive - negative

    sentiments.append(
        sentiment.capitalize()
    )

    sentiment_scores.append(
        sentiment_score
    )


df["sentiment"] = sentiments

df["sentiment_score"] = sentiment_scores


# =========================
# 9. Check results
# =========================

print("\n--- Sentiment Results ---")

print(
    df[
        [
            "Tweet",
            "sentiment",
            "sentiment_score"
        ]
    ].head(10)
)

print("\n--- Sentiment Counts ---")

print(
    df["sentiment"].value_counts()
)


# =========================
# 10. Save clean dataset
# =========================

output_path = "data/lab4_clean_tweets.csv"

df.to_csv(
    output_path,
    index=False
)

print("\nSaved to:", output_path)

print("Final shape:", df.shape)


# =========================
# 11. Create visualization data
# =========================

# Divide tweets into three retweet groups
df["retweet_group"] = pd.cut(
    df["RetweetCount"],
    bins=[
        -1,
        0,
        10,
        float("inf")
    ],
    labels=[
        "No Retweets",
        "Low",
        "High"
    ]
)

# Count tweets by retweet group and sentiment
vis_df = (
    df.groupby(
        ["retweet_group", "sentiment"],
        observed=False
    )
    .size()
    .reset_index(name="count")
)

# Save visualization data
vis_df.to_csv(
    "data/sentiment_by_retweet.csv",
    index=False
)

print("\n--- Visualization Data ---")
print(vis_df)

print(
    "\nSaved to: data/sentiment_by_retweet.csv"
)