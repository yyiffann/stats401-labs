import requests
import time
import pandas as pd
from bs4 import BeautifulSoup

records = []

headers = {
    "User-Agent": "STATS401-Class-Exercise/1.0"
}

session = requests.Session()
session.trust_env = False

for page in range(1, 51):

    url = (
        "https://books.toscrape.com/"
        f"catalogue/page-{page}.html"
    )

    try:

        response = session.get(
            url,
            headers=headers,
            timeout=10
        )

        response.raise_for_status()

    except requests.RequestException as error:

        print(
            f"Failed on page {page}:",
            error
        )

        continue

    soup = BeautifulSoup(
        response.text,
        "html.parser"
    )

    books = soup.select(
        "article.product_pod"
    )

    for book in books:

        title = book.select_one(
            "h3 a"
        )["title"]

        price_text = book.select_one(
            ".price_color"
        ).get_text(strip=True)

        price = float(
            price_text.replace("£", "").replace("Â", "")
        )

        rating = book.select_one(
            "p.star-rating"
        )["class"][1]

        records.append({
            "title": title,
            "price": price,
            "rating": rating,
            "page": page
        })

    print(
        f"Page {page}: {len(books)} books"
    )

    time.sleep(1)


df = pd.DataFrame(records)

df.to_csv(
    "data/lab3_data.csv",
    index=False
)

print(
    "Total records:",
    len(df)
)