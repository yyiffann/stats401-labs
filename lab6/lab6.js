// ==========================================
// Lab 6 — GDP Hierarchy with Two Treemaps
// ==========================================

d3.json("../data/lab6_assignment_gdp.json")
    .then(data => {

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


// ==========================================
// Draw Treemap
// ==========================================

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


    // ==========================================
    // SVG
    // ==========================================

    const svg = d3.select(selector)
        .append("svg")
        .attr("width", width)
        .attr("height", height);


    // ==========================================
    // Tooltip
    // ==========================================

    const tooltip = d3.select("#tooltip")
        .style("position", "fixed")
        .style("pointer-events", "none")
        .style("z-index", 1000)
        .style("background", "white")
        .style("border", "1px solid #777")
        .style("padding", "10px 12px")
        .style("border-radius", "5px")
        .style("font-size", "14px")
        .style("line-height", 1.5)
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.2)")
        .style("display", "none")
        .style("opacity", 0);


    // ==========================================
    // Country rectangles
    // ==========================================

    const countries = svg.selectAll(".country")
        .data(root.leaves())
        .join("g")
        .attr("class", "country")
        .attr(
            "transform",
            d => `translate(${d.x0}, ${d.y0})`
        )
        .style("cursor", "pointer");


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


    // ==========================================
    // Country names
    // ==========================================

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


    // ==========================================
    // Mouse interaction
    // ==========================================

    countries
        .on("mouseover", function(event, d) {

            const ancestors = d.ancestors().reverse();

            const continent =
                ancestors[1]?.data.name || "N/A";

            const area =
                ancestors[2]?.data.name || "N/A";

            const status =
                d.data.status;

            tooltip
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
                    <span style="
                        display: inline-block;
                        width: 12px;
                        height: 12px;
                        background: ${statusColor(status)};
                        border: 1px solid #777;
                        margin: 0 4px;
                        vertical-align: middle;
                    "></span>
                    ${status}
                `)
                .style("display", "block")
                .style("opacity", 1)
                .style("left", `${event.clientX + 15}px`)
                .style("top", `${event.clientY + 15}px`);
        })

        .on("mousemove", function(event) {

            tooltip
                .style("left", `${event.clientX + 15}px`)
                .style("top", `${event.clientY + 15}px`);
        })

        .on("mouseout", function() {

            tooltip
                .style("display", "none")
                .style("opacity", 0);
        });
}