const width = 1000;
const height = 700;

const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

const linkGroup = svg.append("g").attr("class", "links");
const nodeGroup = svg.append("g").attr("class", "nodes");

const simulation = d3.forceSimulation();

const tooltip = d3.select("#tooltip")
    .style("position", "fixed")
    .style("pointer-events", "none")
    .style("z-index", 1000)
    .style("background", "white")
    .style("border", "1px solid #777")
    .style("padding", "10px 12px")
    .style("border-radius", "5px")
    .style("font-size", "14px")
    .style("line-height", "1.5")
    .style("box-shadow", "0 2px 8px rgba(0,0,0,0.2)")
    .style("display", "none");

const money = d3.format(",.0f");

let currentDay = 1;
let timer = null;


// =====================================
// Tooltip helpers
// =====================================

function showTooltip(event, html) {
    tooltip
        .html(html)
        .style("display", "block");

    moveTooltip(event);
}

function moveTooltip(event) {
    const node = tooltip.node();

    let left = event.clientX + 15;
    let top = event.clientY + 15;

    // Prevent tooltip from going outside the window
    if (left + node.offsetWidth > window.innerWidth) {
        left = event.clientX - node.offsetWidth - 15;
    }

    if (top + node.offsetHeight > window.innerHeight) {
        top = event.clientY - node.offsetHeight - 15;
    }

    tooltip
        .style("left", `${left}px`)
        .style("top", `${top}px`);
}

function hideTooltip() {
    tooltip.style("display", "none");
}


// =====================================
// Load data
// =====================================

Promise.all([
    d3.csv("../data/lab7_assignment_companies.csv"),
    d3.csv("../data/lab7_assignment_transactions_60days.csv")
])
.then(([companies, transactions]) => {

    transactions.forEach(d => {
        d.day = +d.day;
        d.amount_usd = +d.amount_usd;
        d.transaction_count = +d.transaction_count;
    });

    const nodeMap = new Map(companies.map(d => [d.id, d]));

    // Day number -> date string (works even for days with no transactions)
    const startDate = d3.timeParse("%Y-%m-%d")(
        d3.min(transactions, d => d.date)
    );
    const dateOfDay = day =>
        d3.timeFormat("%Y-%m-%d")(d3.timeDay.offset(startDate, day - 1));


    // =====================================
    // Scales
    // =====================================

    const sectorScale = d3.scaleOrdinal()
        .domain([...new Set(companies.map(d => d.sector))])
        .range(d3.schemeTableau10);

    const regionScale = d3.scaleOrdinal()
        .domain([...new Set(companies.map(d => d.region))])
        .range(["black", "gray", "darkblue", "darkgreen"]);

    // Different palette from sector so node fill and link color are not confused
    const typeScale = d3.scaleOrdinal()
        .domain([...new Set(transactions.map(d => d.transaction_type))])
        .range(d3.schemeSet2);

    const linkWidthScale = d3.scaleLinear()
        .domain(d3.extent(transactions, d => d.amount_usd))
        .range([1, 6]);


    // =====================================
    // Create nodes
    // =====================================

    const nodes = nodeGroup
        .selectAll("circle")
        .data(companies, d => d.id)
        .join("circle")
        .attr("r", 10)
        .attr("fill", d => sectorScale(d.sector))
        .attr("stroke", d => regionScale(d.region))
        .attr("stroke-width", 3)

        .on("mouseover", (event, d) => {
            showTooltip(event, `
                <strong>${d.company_name}</strong><br>
                Sector: ${d.sector}<br>
                Region: ${d.region}<br>
                Current volume: $${money(d.volume || 0)}
            `);
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip)

        .call(
            d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended)
        );


    // =====================================
    // Force simulation
    // =====================================

    simulation
        .nodes(companies)
        .force("link", d3.forceLink().id(d => d.id).distance(110))
        .force("charge", d3.forceManyBody().strength(-250))
        .force("center", d3.forceCenter(width / 2, height / 2))
        // weak pull to the middle keeps unconnected nodes from drifting away
        .force("x", d3.forceX(width / 2).strength(0.05))
        .force("y", d3.forceY(height / 2).strength(0.05))
        .force("collision", d3.forceCollide().radius(35));

    simulation.on("tick", () => {

        linkGroup.selectAll("line")
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        nodes
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
    });


    // =====================================
    // Update network
    // =====================================

    function updateNetwork(currentLinks) {

        // Combine repeated relationships (A-B and B-A count as the same link)
        const groupedLinks = d3.rollups(
            currentLinks,
            values => ({
                amount_usd: d3.sum(values, d => d.amount_usd),
                transaction_count: d3.sum(values, d => d.transaction_count),
                transaction_type: values[0].transaction_type
            }),
            d => [d.source, d.target].sort().join("-")
        );

        const links = groupedLinks.map(([key, v]) => {
            const [s, t] = key.split("-");
            return {
                source: nodeMap.get(s),
                target: nodeMap.get(t),
                amount_usd: v.amount_usd,
                transaction_count: v.transaction_count,
                transaction_type: v.transaction_type
            };
        });


        // Node transaction volume
        const volumeMap = new Map(companies.map(d => [d.id, 0]));

        currentLinks.forEach(d => {
            volumeMap.set(d.source, volumeMap.get(d.source) + d.amount_usd);
            volumeMap.set(d.target, volumeMap.get(d.target) + d.amount_usd);
        });

        companies.forEach(d => { d.volume = volumeMap.get(d.id); });

        const maxVolume = d3.max(Array.from(volumeMap.values())) || 1;

        const sizeScale = d3.scaleSqrt()
            .domain([0, maxVolume])
            .range([7, 28]);


        // Links
        linkGroup
            .selectAll("line")
            .data(links, d => `${d.source.id}-${d.target.id}`)
            .join(
                // New links fade in
                enter => enter
                    .append("line")
                    .attr("stroke", d => typeScale(d.transaction_type))
                    .attr("stroke-width", d => linkWidthScale(d.amount_usd))
                    .attr("opacity", 0)
                    .transition()
                    .duration(400)
                    .attr("opacity", 0.7),

                // Existing links (interrupt cancels a fade-out still in progress)
                update => update
                    .interrupt()
                    .attr("stroke", d => typeScale(d.transaction_type))
                    .attr("stroke-width", d => linkWidthScale(d.amount_usd))
                    .attr("opacity", 0.7),

                // Disappearing links fade out
                exit => exit
                    .transition()
                    .duration(400)
                    .attr("opacity", 0)
                    .remove()
            )
            .on("mouseover", (event, d) => {
                showTooltip(event, `
                    <strong>${d.source.company_name} ↔ ${d.target.company_name}</strong><br>
                    Type: ${d.transaction_type}<br>
                    Amount: $${money(d.amount_usd)}<br>
                    Transactions: ${d.transaction_count}
                `);
            })
            .on("mousemove", moveTooltip)
            .on("mouseout", hideTooltip);


        // Node size
        nodes
            .transition()
            .duration(400)
            .attr("r", d => sizeScale(d.volume));


        // Gentle restart: same nodes, same simulation, low alpha
        simulation.force("link").links(links);
        simulation.alpha(0.2).restart();
    }


    // =====================================
    // Summary
    // =====================================

    function updateSummary(currentLinks) {

        const activeCompanies = new Set(
            currentLinks.flatMap(d => [d.source, d.target])
        );

        d3.select("#active-companies").text(activeCompanies.size);
        d3.select("#active-links").text(currentLinks.length);
        d3.select("#total-value").text(
            money(d3.sum(currentLinks, d => d.amount_usd))
        );
    }


    // =====================================
    // Show one day
    // =====================================

    function showDay(day) {

        currentDay = day;

        const currentLinks = transactions.filter(d => d.day === day);

        d3.select("#date-label").text(`Day ${day} — ${dateOfDay(day)}`);

        updateNetwork(currentLinks);
        updateSummary(currentLinks);

        d3.select("#time-slider").property("value", day);
    }


    // =====================================
    // Play / Pause / Reset
    // =====================================

    function play() {

        if (timer) return;

        // Restart from the beginning if the animation already finished
        if (currentDay >= 60) showDay(1);

        timer = d3.interval(() => {

            showDay(currentDay + 1);

            if (currentDay >= 60) pause();

        }, 600);
    }

    function pause() {

        if (timer) {
            timer.stop();
            timer = null;
        }
    }

    function reset() {

        pause();
        showDay(1);
    }

    d3.select("#play").on("click", play);
    d3.select("#pause").on("click", pause);
    d3.select("#reset").on("click", reset);

    d3.select("#time-slider").on("input", function() {

        pause();
        showDay(+this.value);
    });


    // Initial frame
    showDay(1);

});


// =====================================
// Drag functions
// =====================================

function dragstarted(event, d) {

    if (!event.active) {
        simulation.alphaTarget(0.3).restart();
    }

    d.fx = d.x;
    d.fy = d.y;
}

function dragged(event, d) {

    d.fx = event.x;
    d.fy = event.y;
}

function dragended(event, d) {

    if (!event.active) {
        simulation.alphaTarget(0);
    }

    d.fx = null;
    d.fy = null;
}