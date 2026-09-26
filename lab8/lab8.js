const colors = d3.scaleOrdinal(d3.schemeTableau10);

Promise.all([
  d3.csv("../data/lab8/lab8_embedding_map.csv", (d) => ({
    ...d,
    x: +d.x,
    y: +d.y,
    word_count: +d.word_count,
    cluster: +d.cluster,
    page_pdf: +d.page_pdf,
  })),
  d3.csv("../data/lab8/lab8_topic_section_matrix.csv", (d) => ({
    ...d,
    count: +d.count,
  })),
])
  .then(([data, counts]) => {
    const byId = new Map(data.map((d) => [d.passage_id, d]));
    const topics = [...new Set(data.map((d) => d.cluster_name))].sort();
    const sections = [...new Set(data.map((d) => d.section))].sort();

    topics.forEach((topic) => colors(topic));

    // Corpus overview
    d3.select("#stats").text(
      `${data.length} passages after cleaning · ` +
        `${Math.round(d3.mean(data, (d) => d.word_count))} words per passage on average · ` +
        `${sections.length} sections`,
    );

    const sectionCounts = d3.rollup(
      data,
      (passages) => passages.length,
      (d) => d.section,
    );

    const topSections = [...sectionCounts]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    const maxSection = topSections[0][1];

    d3.select("#bars")
      .selectAll(".bar")
      .data(topSections)
      .join("div")
      .attr("class", "bar")
      .style("width", ([, count]) => `${25 + (65 * count) / maxSection}%`)
      .text(([section, count]) => `${section}: ${count}`);


    // Section and topic menus
    for (const [id, values] of [
      ["section", sections],
      ["topic", topics],
    ]) {
      d3.select(`#${id}`)
        .selectAll("option.extra")
        .data(values)
        .join("option")
        .attr("class", "extra")
        .attr("value", (d) => d)
        .text((d) => d);
    }

    d3.select("#legend")
      .selectAll(".legend-item")
      .data(topics)
      .join("span")
      .attr("class", "legend-item")
      .html(
        (topic) =>
          `<span class="swatch" style="background:${colors(topic)}"></span>` +
          topic.replaceAll("<", "&lt;"),
      );

    // Semantic map
    const svg = d3.select("#map");
    const layer = svg.append("g");

    const x = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d.x))
      .range([35, 865]);

    const y = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d.y))
      .range([565, 35]);

    const radius = d3
      .scaleSqrt()
      .domain(d3.extent(data, (d) => d.word_count))
      .range([2.5, 7]);

    let selected = null;
    let cell = null;

    const points = layer
      .selectAll("circle")
      .data(data)
      .join("circle")
      .attr("class", "passage")
      .attr("cx", (d) => x(d.x))
      .attr("cy", (d) => y(d.y))
      .attr("r", (d) => radius(d.word_count))
      .attr("fill", (d) => colors(d.cluster_name));

    svg.call(
      d3
        .zoom()
        .scaleExtent([0.65, 15])
        .on("zoom", (event) => layer.attr("transform", event.transform)),
    );

    // Escape passage text before inserting it into HTML
    const escapeHtml = (value) =>
      String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");

    function showDetails(d) {
      const neighbors = (d.neighbor_ids || "")
        .split("|")
        .map((id) => byId.get(id))
        .filter(Boolean);

      d3.select("#details").html(`
        <h3>${escapeHtml(d.passage_id)} · ${escapeHtml(d.cluster_name)}</h3>
        <p>
          <b>Chapter:</b> ${escapeHtml(d.chapter)}<br>
          <b>Section:</b> ${escapeHtml(d.section)}<br>
          <b>Subsection:</b> ${escapeHtml(d.subsection)}<br>
          <b>PDF page:</b> ${d.page_pdf}
        </p>
        <p>${escapeHtml(d.text)}</p>
        <h4>Five nearest semantic passages</h4>
        ${neighbors
          .map(
            (neighbor) => `
              <p>
                <button class="goto" data-id="${escapeHtml(neighbor.passage_id)}">
                  ${escapeHtml(neighbor.passage_id)}
                </button>
                ${escapeHtml(neighbor.section)} · PDF p. ${neighbor.page_pdf}<br>
                ${escapeHtml(neighbor.text.slice(0, 190))}…
              </p>
            `,
          )
          .join("")}
      `);

      d3.selectAll(".goto").on("click", function () {
        selectPassage(byId.get(this.dataset.id));
      });
    }

    function selectPassage(d) {
      selected = d;
      cell = null;
      showDetails(d);
      updateHighlights();
    }

    // Topic × section matrix
    const cellWidth = 115;
    const rowHeight = 24;
    const left = 280;
    const top = 130;
    const matrixWidth = left + cellWidth * topics.length + 20;
    const matrixHeight = top + rowHeight * sections.length + 25;

    const matrix = d3
      .select("#matrix")
      .append("svg")
      .attr("width", matrixWidth)
      .attr("height", matrixHeight);

    matrix
      .selectAll(".col")
      .data(topics)
      .join("text")
      .attr(
        "transform",
        (topic, i) =>
          `translate(${left + cellWidth * i + 10},${top - 10}) rotate(-48)`,
      )
      .text((topic) => topic)
      .style("font-size", "12px");

    matrix
      .selectAll(".row")
      .data(sections)
      .join("text")
      .attr("x", left - 8)
      .attr("y", (section, i) => top + rowHeight * i + 16)
      .attr("text-anchor", "end")
      .text((section) =>
        section.length > 39 ? section.slice(0, 36) + "…" : section,
      )
      .append("title")
      .text((section) => section);

    const countLookup = new Map(
      counts.map((d) => [d.section + "\u0000" + d.cluster_name, d.count]),
    );

    const matrixData = sections.flatMap((section, i) =>
      topics.map((cluster_name, j) => ({
        section,
        cluster_name,
        count: countLookup.get(section + "\u0000" + cluster_name) || 0,
        i,
        j,
      })),
    );

    const shade = d3
      .scaleSequential(d3.interpolateBlues)
      .domain([0, d3.max(matrixData, (d) => d.count) || 1]);

    const cells = matrix
      .selectAll(".cell")
      .data(matrixData)
      .join("rect")
      .attr("class", "cell")
      .attr("x", (d) => left + d.j * cellWidth)
      .attr("y", (d) => top + d.i * rowHeight)
      .attr("width", cellWidth - 2)
      .attr("height", rowHeight - 2)
      .attr("fill", (d) => shade(d.count))
      .attr("stroke", "#fff");

    function updateHighlights() {
      const query = d3
        .select("#search")
        .property("value")
        .toLowerCase()
        .trim();

      const sectionFilter = d3.select("#section").property("value");
      const topicFilter = d3.select("#topic").property("value");

      const neighborIds = new Set(
        (selected?.neighbor_ids || "").split("|"),
      );

      points
        .attr("opacity", (d) => {
          const matches =
            (!query || d.text.toLowerCase().includes(query)) &&
            (!sectionFilter || d.section === sectionFilter) &&
            (!topicFilter || d.cluster_name === topicFilter) &&
            (!cell ||
              (d.section === cell.section &&
                d.cluster_name === cell.cluster_name));

          return matches ||
            d === selected ||
            neighborIds.has(d.passage_id)
            ? 0.95
            : 0.065;
        })
        .classed("chosen", (d) => d === selected)
        .classed(
          "neighbor",
          (d) => d !== selected && neighborIds.has(d.passage_id),
        );

      cells
        .attr("stroke", (d) =>
          d === cell ||
          (selected &&
            d.section === selected.section &&
            d.cluster_name === selected.cluster_name)
            ? "#111"
            : "#fff",
        )
        .attr("stroke-width", (d) =>
          d === cell ||
          (selected &&
            d.section === selected.section &&
            d.cluster_name === selected.cluster_name)
            ? 3
            : 1,
        );
    }

    points.on("click", (event, d) => selectPassage(d));

    d3.selectAll("#search, #section, #topic").on(
      "input",
      updateHighlights,
    );

    d3.select("#clear").on("click", () => {
      selected = null;
      cell = null;

      d3.select("#search").property("value", "");
      d3.select("#section").property("value", "");
      d3.select("#topic").property("value", "");

      d3.select("#details").text(
        "Click a dot or matrix cell to explore its passages.",
      );

      updateHighlights();
    });

    cells
      .on("mouseover", (event, d) => {
        const sectionTotal = sectionCounts.get(d.section);

        d3.select("#tip").text(
          `${d.section} × ${d.cluster_name}: ${d.count} passages ` +
            `(${((100 * d.count) / sectionTotal).toFixed(1)}% of section)`,
        );
      })
      .on("mouseout", () => d3.select("#tip").text(""))
      .on("click", (event, d) => {
        cell = d;
        selected = null;

        const matches = data.filter(
          (passage) =>
            passage.section === d.section &&
            passage.cluster_name === d.cluster_name,
        );

        d3.select("#details").html(`
          <h3>${escapeHtml(d.section)} × ${escapeHtml(d.cluster_name)}</h3>
          <p>${matches.length} passages</p>
          ${matches
            .slice(0, 20)
            .map(
              (passage) => `
                <p>
                  <button class="goto" data-id="${escapeHtml(passage.passage_id)}">
                    ${escapeHtml(passage.passage_id)}
                  </button>
                  PDF p. ${passage.page_pdf}:
                  ${escapeHtml(passage.text.slice(0, 200))}…
                </p>
              `,
            )
            .join("")}
        `);

        d3.selectAll(".goto").on("click", function () {
          selectPassage(byId.get(this.dataset.id));
        });

        updateHighlights();
      });

    updateHighlights();
  })
  .catch((error) => {
    d3.select("#stats").text(
      "Data not available. Run prepare.py first and serve the project " +
        "from its root. " +
        error.message,
    );
    console.error(error);
  });