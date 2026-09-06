d3.csv(
    "../data/sentiment_by_retweet.csv",
    d => ({
        ...d,
        count: +d.count
    })
)
.then(data => {

    console.log(data);

    // =========================
    // 1. Chart dimensions
    // =========================

    const margin = {
        top: 50,
        right: 150,
        bottom: 80,
        left: 70
    };

    const width = 800;
    const height = 500;


    // =========================
    // 2. Create SVG
    // =========================

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);


    // =========================
    // 3. Get groups and sentiments
    // =========================

    const retweetGroups = [
        "No Retweets",
        "Low",
        "High"
    ];

    const sentiments = [
        "Positive",
        "Neutral",
        "Negative"
    ];


    // =========================
    // 4. Create scales
    // =========================

    const x0 = d3.scaleBand()
        .domain(retweetGroups)
        .range([
            margin.left,
            width - margin.right
        ])
        .padding(0.2);


    const x1 = d3.scaleBand()
        .domain(sentiments)
        .range([
            0,
            x0.bandwidth()
        ])
        .padding(0.08);


    const y = d3.scaleLinear()
        .domain([
            0,
            d3.max(data, d => d.count)
        ])
        .nice()
        .range([
            height - margin.bottom,
            margin.top
        ]);


    // =========================
    // 5. Color scale
    // =========================

    const color = d3.scaleOrdinal()
        .domain(sentiments)
        .range([
            "#E5989B",
            "#B8B8D1",
            "#6C8EAD"
        ]);


    // =========================
    // 6. X axis
    // =========================

    svg.append("g")
        .attr(
            "transform",
            `translate(0,${height - margin.bottom})`
        )
        .call(
            d3.axisBottom(x0)
        );


    // =========================
    // 7. Y axis
    // =========================

    svg.append("g")
        .attr(
            "transform",
            `translate(${margin.left},0)`
        )
        .call(
            d3.axisLeft(y)
        );


    // =========================
    // 8. X axis label
    // =========================

    svg.append("text")
        .attr(
            "x",
            width / 2
        )
        .attr(
            "y",
            height - 25
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .text(
            "Retweet Group"
        );


    // =========================
    // 9. Y axis label
    // =========================

    svg.append("text")
        .attr(
            "transform",
            "rotate(-90)"
        )
        .attr(
            "x",
            -height / 2
        )
        .attr(
            "y",
            20
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .text(
            "Number of Tweets"
        );


    // =========================
    // 10. Tooltip
    // =========================

    const tooltip = d3.select("#tooltip");


    // =========================
    // 11. Create grouped bars
    // =========================

    svg.selectAll(".retweet-group")
        .data(retweetGroups)
        .join("g")
        .attr(
            "class",
            "retweet-group"
        )
        .attr(
            "transform",
            d => `translate(${x0(d)},0)`
        )
        .selectAll("rect")
        .data(retweetGroup => {

            return sentiments.map(sentiment => {

                const item = data.find(
                    d =>
                        d.retweet_group === retweetGroup &&
                        d.sentiment === sentiment
                );

                return {
                    retweet_group: retweetGroup,
                    sentiment: sentiment,
                    count: item ? item.count : 0
                };

            });

        })
        .join("rect")
        .attr(
            "x",
            d => x1(d.sentiment)
        )
        .attr(
            "y",
            d => y(d.count)
        )
        .attr(
            "width",
            x1.bandwidth()
        )
        .attr(
            "height",
            d => y(0) - y(d.count)
        )
        .attr(
            "fill",
            d => color(d.sentiment)
        )
        .on(
            "mouseover",
            function(event, d) {

                tooltip
                    .style(
                        "display",
                        "block"
                    )
                    .html(
                        `<strong>${d.retweet_group}</strong><br>
                        Sentiment: ${d.sentiment}<br>
                        Tweets: ${d.count}`
                    );

            }
        )
        .on(
            "mousemove",
            function(event) {

                tooltip
                    .style(
                        "left",
                        `${event.pageX + 10}px`
                    )
                    .style(
                        "top",
                        `${event.pageY - 30}px`
                    );

            }
        )
        .on(
            "mouseout",
            function() {

                tooltip
                    .style(
                        "display",
                        "none"
                    );

            }
        );


    // =========================
    // 12. Legend
    // =========================

    const legend = svg.append("g")
        .attr(
            "transform",
            `translate(${width - margin.right + 30},${margin.top})`
        );


    sentiments.forEach(
        (sentiment, i) => {

            const row = legend.append("g")
                .attr(
                    "transform",
                    `translate(0,${i * 30})`
                );


            row.append("rect")
                .attr(
                    "width",
                    18
                )
                .attr(
                    "height",
                    18
                )
                .attr(
                    "fill",
                    color(sentiment)
                );


            row.append("text")
                .attr(
                    "x",
                    25
                )
                .attr(
                    "y",
                    14
                )
                .text(
                    sentiment
                );

        }
    );

});