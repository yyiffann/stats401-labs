d3.json("../data/lab6_assignment_gdp.json")
    .then(data => {

        console.log("Loaded data:", data);


        const statusColor = d3.scaleOrdinal()
            .domain([
                "Increase",
                "Unchanged",
                "Decrease"
            ])
            .range([
                "#2ca02c",
                "#7f7f7f",
                "#d62728"
            ]);


        drawTreemap(
            "#treemap1",
            data,
            d3.treemapSquarify,
            statusColor
        );


        drawTreemap(
            "#treemap2",
            data,
            d3.treemapBinary,
            statusColor
        );

    })
    .catch(error => {
        console.error("Error loading JSON:", error);
    });


function drawTreemap(
    selector,
    data,
    tileMethod,
    statusColor
) {

    const width = 900;
    const height = 550;


    const root = d3.hierarchy(data)
        .sum(d => d.gdp || 0)
        .sort((a, b) => b.value - a.value);


    const treemap = d3.treemap()
        .size([width, height])
        .paddingInner(3)
        .paddingOuter(5)
        .tile(tileMethod);

    treemap(root);


    const svg = d3.select(selector)
        .append("svg")
        .attr("width", width)
        .attr("height", height);


    const tooltip = d3.select("#tooltip");


    const countries = svg.selectAll(".country")
        .data(root.leaves())
        .join("g")
        .attr("class", "country")
        .attr(
            "transform",
            d => `translate(${d.x0}, ${d.y0})`
        );


    countries.append("rect")
        .attr(
            "width",
            d => Math.max(0, d.x1 - d.x0)
        )
        .attr(
            "height",
            d => Math.max(0, d.y1 - d.y0)
        )
        .attr(
            "fill",
            d => statusColor(d.data.status)
        )
        .attr("stroke", "white")
        .attr("stroke-width", 1);


    countries
        .filter(d =>
            (d.x1 - d.x0) > 50 &&
            (d.y1 - d.y0) > 25
        )
        .append("text")
        .attr("x", 5)
        .attr("y", 17)
        .attr("fill", "white")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .text(d => d.data.name);


    const internalNodes = root.descendants()
        .filter(d =>
            d.depth > 0 &&
            d.children
        );


    const groups = svg.selectAll(".group")
        .data(internalNodes)
        .join("g")
        .attr("class", "group")
        .attr(
            "transform",
            d => `translate(${d.x0}, ${d.y0})`
        );


    groups.append("rect")
        .attr(
            "width",
            d => Math.max(0, d.x1 - d.x0)
        )
        .attr(
            "height",
            d => Math.max(0, d.y1 - d.y0)
        )
        .attr("fill", "none")
        .attr(
            "stroke",
            d => d.depth === 1
                ? "#222"
                : "#777"
        )
        .attr(
            "stroke-width",
            d => d.depth === 1
                ? 3
                : 1.5
        );


    const continents = groups
        .filter(d => d.depth === 1);


    continents
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr(
            "width",
            d => Math.min(
                d.x1 - d.x0,
                150
            )
        )
        .attr("height", 26)
        .attr("fill", "white")
        .attr("opacity", 0.9);


    continents
        .append("text")
        .attr("x", 5)
        .attr("y", 18)
        .attr("font-size", "15px")
        .attr("font-weight", "bold")
        .attr("fill", "#222")
        .text(d => d.data.name);


    const areas = groups
        .filter(d =>
            d.depth === 2 &&
            (d.x1 - d.x0) > 80 &&
            (d.y1 - d.y0) > 30
        );


    areas
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr(
            "width",
            d => Math.min(
                d.x1 - d.x0,
                140
            )
        )
        .attr("height", 22)
        .attr("fill", "white")
        .attr("opacity", 0.9);


    areas
        .append("text")
        .attr("x", 5)
        .attr("y", 16)
        .attr("font-size", "12px")
        .attr("fill", "#222")
        .text(d => d.data.name);


    countries
        .on("mouseover", function(event, d) {

            const ancestors =
                d.ancestors().reverse();

            const continent =
                ancestors[1]?.data.name || "N/A";

            const area =
                ancestors[2]?.data.name || "N/A";

            const status =
                d.data.status;

                
            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.data.name}</strong>
                    <br>
                    Continent: ${continent}
                    <br>
                    Area: ${area}
                    <br>
                    GDP: ${d.data.gdp} billion USD
                    <br>
                    Status:
                    <span
                        style="
                            display:inline-block;
                            width:12px;
                            height:12px;
                            background:${statusColor(status)};
                            margin:0 5px;
                            border:1px solid #777;
                        "
                    ></span>
                    ${status}
                `);
        })


        .on("mousemove", function(event) {

            tooltip
                .style(
                    "left",
                    `${event.pageX + 12}px`
                )
                .style(
                    "top",
                    `${event.pageY + 12}px`
                );
        })


        .on("mouseout", function() {

            tooltip
                .style("opacity", 0);
        });
}