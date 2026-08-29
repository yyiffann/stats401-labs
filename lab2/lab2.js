const width = 800;
const height = 500;

const margin = {
    top: 40,
    right: 170,
    bottom: 70,
    left: 70
};

const tooltip = d3.select("#tooltip");

d3.csv(
    "../data/cities_multivariate.csv",
    d => ({
        city: d.city,
        population: +d.population,
        temp_c: +temp_c,
        development_level: d.development_level,
        region: d.region
    })
)
.then(data => {

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.city))
        .nice()
        .range([
            margin.left,
            width - margin.right
        ]);

    const yScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.population))
        .nice()
        .range([
            height - margin.bottom,
            margin.top
        ]);

    const regions = Array.from(
        new Set(data.map(d => d.region))
    );

    const colorScale = d3.scaleOrdinal()
        .domain(regions)
        .range(d3.schemeTableau10);

    const sizeScale = d3.scaleOrdinal()
        .domain([
            "Low",
            "Medium",
            "High",
        ])
        .range([5, 7, 9]);

    svg.append("g")
        .attr(
            "transform",
            `translate(0, ${height - margin.bottom})`
        )
        .call(d3.axisBottom(xScale));

    svg.append("g")
        .attr(
            "transform",
            `translate(${margin.left}, 0)`
        )
        .call(d3.axisLeft(yScale));

    svg.selectAll(".city-point")
        .data(data)
        .join("circle")
        .attr("class", "city-point")
        .attr(
            "cx",
            d => xScale(d.population)
        )
        .attr(
            "cy",
            d => yScale(d.temp_c)
        )
        .attr(
            "r",
            d => sizeScale(d.development_level)
        )
        .attr(
            "fill",
            d => colorScale(d.region)
        )
        .attr("opacity", 0.8)
        .on("mouseover", function(event, d) {

            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.city}</strong><br>
                    Population in millions: ${d.population}<br>
                    Average temperature in Celsius: ${d.temp_c}<br>
                    Development level: ${d.region}<br>
                    Region: ${d.development_level}
                `);
        })
        .on("mousemove", function(event) {

            tooltip
                .style(
                    "left",
                    `${event.pageX + 10}px`
                )
                .style(
                    "top",
                    `${event.pageY + 10}px`
                );
        })
        .on("mouseout", function() {

            tooltip
                .style("opacity", 0);
        });
});