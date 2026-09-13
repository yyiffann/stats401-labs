// ========================================
// 1. Load station and route data
// ========================================

Promise.all([

    d3.csv(
        "../data/lab5_assignment_stations.csv",
        d => ({
            id: d.id,
            station_name: d.station_name,
            district: d.district,
            daily_passengers: +d.daily_passengers,
            station_type: d.station_type
        })
    ),

    d3.csv(
        "../data/lab5_assignment_routes.csv",
        d => ({
            source: d.source,
            target: d.target,
            travel_time_min: +d.travel_time_min,
            route_type: d.route_type
        })
    )

]).then(([nodes, links]) => {


    // ========================================
    // 2. Create SVG
    // ========================================

    const width = 850;
    const height = 600;

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);


    // ========================================
    // 3. Create node lookup
    // ========================================

    const nodeById = new Map(
        nodes.map(d => [d.id, d])
    );


    // ========================================
    // 4. Calculate node degree
    // ========================================

    nodes.forEach(node => {

        node.degree = links.filter(link =>
            link.source === node.id ||
            link.target === node.id
        ).length;

    });


    // ========================================
    // 5. Node size scale
    // daily_passengers → node size
    // ========================================

    const sizeScale = d3.scaleSqrt()
        .domain(
            d3.extent(
                nodes,
                d => d.daily_passengers
            )
        )
        .range([6, 22]);


    // ========================================
    // 6. District color scale
    // district → node color
    // ========================================

    const districts = Array.from(
        new Set(
            nodes.map(d => d.district)
        )
    );

    const districtColor = d3.scaleOrdinal()
        .domain(districts)
        .range(d3.schemeTableau10);


    // ========================================
    // 7. Route type color scale
    // route_type → link color
    // ========================================

    const routeTypes = Array.from(
        new Set(
            links.map(d => d.route_type)
        )
    );

    const routeColor = d3.scaleOrdinal()
        .domain(routeTypes)
        .range(d3.schemeSet2);


    // ========================================
    // 8. Travel time scale
    // travel_time_min → link width
    // ========================================

    const travelTimeScale = d3.scaleLinear()
        .domain(
            d3.extent(
                links,
                d => d.travel_time_min
            )
        )
        .range([1, 7]);


    // ========================================
    // 9. Draw links
    // ========================================

    const link = svg.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke", d => routeColor(d.route_type))
        .attr("stroke-width", d =>
            travelTimeScale(d.travel_time_min)
        )
        .attr("stroke-opacity", 0.65);


    // ========================================
    // 10. Draw node groups
    // ========================================

    const node = svg.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(nodes)
        .join("g");


    // ========================================
    // 11. Draw different shapes
    // station_type → node shape
    // ========================================

    node.append("path")
        .attr("d", d => {

            if (d.station_type === "Transfer") {

                return d3.symbol()
                    .type(d3.symbolSquare)
                    .size(
                        Math.pow(
                            sizeScale(d.daily_passengers),
                            2
                        )
                    )();

            }

            if (d.station_type === "Terminal") {

                return d3.symbol()
                    .type(d3.symbolTriangle)
                    .size(
                        Math.pow(
                            sizeScale(d.daily_passengers),
                            2
                        )
                    )();

            }

            return d3.symbol()
                .type(d3.symbolCircle)
                .size(
                    Math.pow(
                        sizeScale(d.daily_passengers),
                        2
                    )
                )();

        })
        .attr("fill", d =>
            districtColor(d.district)
        )
        .attr("stroke", "black")
        .attr("stroke-width", 1.2);


    // ========================================
    // 12. Add node labels
    // ========================================

    const label = svg.append("g")
        .attr("class", "labels")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .text(d => d.station_name)
        .attr("font-size", 10)
        .attr("dx", 10)
        .attr("dy", 4);


    // ========================================
    // 13. Force simulation
    // ========================================

    const simulation = d3.forceSimulation(nodes)

        .force(
            "link",
            d3.forceLink(links)
                .id(d => d.id)
                .distance(90)
            )

        .force(
            "charge",
            d3.forceManyBody()
                .strength(-180)
            )

        .force(
            "center",
            d3.forceCenter(
                width / 2,
                height / 2
            )
            )

        .force(
            "collision",
            d3.forceCollide()
                .radius(25)
            );


    // ========================================
    // 14. Update positions
    // ========================================

    simulation.on("tick", () => {

        nodes.forEach(d => {
            d.x = Math.max(30, Math.min(width - 30, d.x));
            d.y = Math.max(30, Math.min(height - 30, d.y));
        });

        link
            .attr(
                "x1",
                d => d.source.x
            )
            .attr(
                "y1",
                d => d.source.y
            )
            .attr(
                "x2",
                d => d.target.x
            )
            .attr(
                "y2",
                d => d.target.y
            );


        node.attr(
            "transform",
            d =>
                `translate(${d.x},${d.y})`
        );


        label
            .attr(
                "x",
                d => d.x
            )
            .attr(
                "y",
                d => d.y
            );

    });


    // ========================================
    // 15. Dragging
    // ========================================

    function dragStarted(event, d) {

        if (!event.active) {

            simulation
                .alphaTarget(0.3)
                .restart();

        }

        d.fx = d.x;
        d.fy = d.y;

    }


    function dragged(event, d) {

        d.fx = event.x;
        d.fy = event.y;

    }


    function dragEnded(event, d) {

        if (!event.active) {

            simulation
                .alphaTarget(0);

        }

        d.fx = null;
        d.fy = null;

    }


    node.call(
        d3.drag()
            .on(
                "start",
                dragStarted
            )
            .on(
                "drag",
                dragged
            )
            .on(
                "end",
                dragEnded
            )
    );


    // ========================================
    // 16. Highlight connected nodes
    // ========================================

    function isConnected(nodeA, nodeB) {

        return links.some(link =>

            (
                link.source.id === nodeA.id &&
                link.target.id === nodeB.id
            )

            ||

            (
                link.source.id === nodeB.id &&
                link.target.id === nodeA.id
            )

        );

    }


    node.on(
        "mouseover.highlight",
        function(event, d) {

            node.attr(
                "opacity",
                other =>

                    (
                        other.id === d.id ||
                        isConnected(d, other)
                    )

                    ? 1
                    : 0.15
            );


            link.attr(
                "opacity",
                l =>

                    (
                        l.source.id === d.id ||
                        l.target.id === d.id
                    )

                    ? 1
                    : 0.08
            );


            label.attr(
                "opacity",
                other =>

                    (
                        other.id === d.id ||
                        isConnected(d, other)
                    )

                    ? 1
                    : 0.15
            );

        }
    );


    node.on(
        "mouseout.highlight",
        function() {

            node.attr(
                "opacity",
                1
            );

            link.attr(
                "opacity",
                0.65
            );

            label.attr(
                "opacity",
                1
            );

        }
    );


    // ========================================
    // 17. Tooltip
    // ========================================

    const tooltip = d3.select("#tooltip");


    node.on(
        "mouseover.tooltip",
        function(event, d) {

            tooltip
                .style(
                    "opacity",
                    1
                )
                .html(`
                    <strong>${d.station_name}</strong>
                    <br>
                    District: ${d.district}
                    <br>
                    Daily passengers: ${d.daily_passengers}
                    <br>
                    Station type: ${d.station_type}
                    <br>
                    Direct connections: ${d.degree}
                `);

        }
    );


    node.on(
        "mousemove.tooltip",
        function(event) {

            tooltip
                .style(
                    "left",
                    `${event.pageX + 12}px`
                )
                .style(
                    "top",
                    `${event.pageY + 12}px`
                );

        }
    );


    node.on(
        "mouseout.tooltip",
        function() {

            tooltip.style(
                "opacity",
                0
            );

        }
    );


    // ========================================
    // 18. Node-Link Legend
    // ========================================

    const legend = d3.select("#legend");

    legend.html(`
        <h3>Legend</h3>

        <p>
            <strong>District:</strong>
            Node color
        </p>

        <p>
            <strong>Passenger volume:</strong>
            Node size
        </p>

        <p>
            <strong>Station type:</strong>
            Circle = Local,
            Square = Transfer,
            Triangle = Terminal
        </p>

        <p>
            <strong>Travel time:</strong>
            Link width
        </p>

        <p>
            <strong>Route type:</strong>
            Link color
        </p>
    `);


    // ========================================
    // 19. Adjacency Matrix Data
    // ========================================

    const matrixData = [];


    nodes.forEach(rowNode => {

        nodes.forEach(colNode => {

            const foundLink = links.find(link =>

                (
                    link.source.id === rowNode.id &&
                    link.target.id === colNode.id
                )

                ||

                (
                    link.source.id === colNode.id &&
                    link.target.id === rowNode.id
                )

            );


            matrixData.push({

                row: rowNode.id,

                col: colNode.id,

                weight:
                    foundLink
                    ? foundLink.travel_time_min
                    : 0,

                type:
                    foundLink
                    ? foundLink.route_type
                    : null

            });

        });

    });


    // ========================================
    // 20. Order stations by district
    // ========================================

    const districtOrder = [
        "Central",
        "North",
        "South",
        "East",
        "West"
    ];


    const orderedNodes = [...nodes].sort(
        (a, b) => {

            const districtDifference =
                districtOrder.indexOf(a.district) -
                districtOrder.indexOf(b.district);

            if (districtDifference !== 0) {
                return districtDifference;
            }

            return d3.ascending(
                a.id,
                b.id
            );

        }
    );


    const orderedIds =
        orderedNodes.map(d => d.id);


    // ========================================
    // 21. Matrix scales
    // ========================================

    const matrixSize = 750;

    const matrixX = d3.scaleBand()
        .domain(orderedIds)
        .range([0, matrixSize])
        .padding(0.03);


    const matrixY = d3.scaleBand()
        .domain(orderedIds)
        .range([0, matrixSize])
        .padding(0.03);


    // ========================================
    // 22. Matrix SVG
    // ========================================

    const matrixSvg = d3.select("#matrix")
        .append("svg")
        .attr("width", 950)
        .attr("height", 950);


    const matrixGroup = matrixSvg
        .append("g")
        .attr(
            "transform",
            "translate(120,100)"
        );


    // ========================================
    // 23. Matrix opacity scale
    // travel time → cell opacity
    // ========================================

    const opacityScale = d3.scaleLinear()
        .domain(
            d3.extent(
                links,
                d => d.travel_time_min
            )
        )
        .range([0.35, 1]);


    // ========================================
    // 24. Draw matrix cells
    // ========================================

    matrixGroup
        .selectAll("rect")
        .data(matrixData)
        .join("rect")

        .attr(
            "x",
            d => matrixX(d.col)
        )

        .attr(
            "y",
            d => matrixY(d.row)
        )

        .attr(
            "width",
            matrixX.bandwidth()
        )

        .attr(
            "height",
            matrixY.bandwidth()
        )

        .attr(
            "fill",
            d =>
                d.weight > 0
                ? routeColor(d.type)
                : "#eeeeee"
        )

        .attr(
            "fill-opacity",
            d =>
                d.weight > 0
                ? opacityScale(d.weight)
                : 1
        )

        .attr(
            "stroke",
            "#ffffff"
        );


    // ========================================
    // 25. Matrix row labels
    // ========================================

    matrixGroup
        .selectAll(".row-label")
        .data(orderedNodes)
        .join("text")
        .attr(
            "class",
            "row-label"
        )
        .attr(
            "x",
            -8
        )
        .attr(
            "y",
            d =>
                matrixY(d.id) +
                matrixY.bandwidth() / 2
        )
        .attr(
            "text-anchor",
            "end"
        )
        .attr(
            "dominant-baseline",
            "middle"
        )
        .attr(
            "font-size",
            9
        )
        .attr(
            "fill",
            d => districtColor(d.district)
        )
        .text(
            d => d.station_name
        );


    // ========================================
    // 26. Matrix column labels
    // ========================================

    matrixGroup
        .selectAll(".column-label")
        .data(orderedNodes)
        .join("text")
        .attr(
            "class",
            "column-label"
        )
        .attr(
            "x",
            d =>
                matrixX(d.id) +
                matrixX.bandwidth() / 2
        )
        .attr(
            "y",
            -8
        )
        .attr(
            "text-anchor",
            "start"
        )
        .attr(
            "font-size",
            9
        )
        .attr(
            "fill",
            d => districtColor(d.district)
        )
        .attr(
            "transform",
            d =>
                `rotate(-60,
                ${matrixX(d.id) +
                matrixX.bandwidth() / 2},
                -8)`
        )
        .text(
            d => d.station_name
        );


});