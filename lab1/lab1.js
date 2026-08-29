async function loadData() {

    const data = await d3.csv(
        "../data/students.csv",
        d => ({
            name: d.name,
            score: +d.score
        })
    );

    const width = 800;
    const height = 500;

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    svg.selectAll("rect")
        .data(data)
        .join("rect")
        .attr("x", (d, i) => 50 + i * 90)
        .attr("y", d => 400 - d.score * 3)
        .attr("width", 60)
        .attr("height", d => d.score * 3)
        .attr("class", "bar");

    svg.selectAll(".score-label")
        .data(data)
        .join("text")
        .attr("class", "score-label")
        .attr("x", (d, i) => 80 + i * 90)
        .attr("y", 425)
        .attr("text-anchor", "middle")
        .text(d => d.score);

    svg.selectAll(".name-label")
        .data(data)
        .join("text")
        .attr("class", "name-label")
        .attr("x", (d, i) => 80 + i * 90)
        .attr("y", 450)
        .attr("text-anchor", "middle")
        .text(d => d.name);
}

loadData();