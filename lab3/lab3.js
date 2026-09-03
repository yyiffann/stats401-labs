d3.csv("../data/lab3_data.csv")
    .then(data => {

        // Convert price to number
        data.forEach(d => {
            d.price = +d.price;
        });

        const columns = data.columns;

        let ascending = true;

        const table = d3.select(
            "#data-table"
        );

        const header = table
            .select("thead")
            .append("tr");

        header.selectAll("th")
            .data(columns)
            .join("th")
            .text(d => d)
            .style("cursor", "pointer")
            .on(
                "click",
                function(event, column) {

                    data.sort(
                        (a, b) => {

                            if (column === "price") {

                                return ascending
                                    ? d3.ascending(
                                        +a[column],
                                        +b[column]
                                    )
                                    : d3.descending(
                                        +a[column],
                                        +b[column]
                                    );

                            }

                            return ascending
                                ? d3.ascending(
                                    a[column],
                                    b[column]
                                )
                                : d3.descending(
                                    a[column],
                                    b[column]
                                );
                        }
                    );

                    ascending = !ascending;

                    updateRows();
                }
            );

        function updateRows() {

            const rows = table
                .select("tbody")
                .selectAll("tr")
                .data(data);

            rows.join("tr")
                .selectAll("td")
                .data(
                    row =>
                        columns.map(
                            column =>
                                row[column]
                        )
                )
                .join("td")
                .text(d => d);
        }

        updateRows();

    });