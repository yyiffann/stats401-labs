// ============================================================
// Lab 9
// 2025 GDP: Choropleth vs. Non-Contiguous Cartogram
// ============================================================


const MAP_HEIGHT = 430;

const noDataColor = "#e5e7eb";
const cartogramColor = "#9ecae1";
const selectedColor = "#f59e0b";

const formatGDP = d3.format(",.0f");


// ============================================================
// Shared state
// ============================================================

let selectedIso = null;
let geoDataGlobal = null;

let choroplethCountries = null;
let cartogramCountries = null;

let choroplethSvg = null;
let choroplethZoom = null;

const tooltip = d3.select("#lab9-tooltip");


// ============================================================
// Load data
// ============================================================

Promise.all([

    d3.json("../data/world.geojson"),

    d3.csv(
        "../data/lab9_gdp_2025_top50.csv",
        d => ({
            iso3: d.iso3.trim().toUpperCase(),
            country: d.country,
            gdp: +d.gdp_2025_billion_usd,
            rank: +d.rank
        })
    )

])
.then(([geoData, gdpData]) => {


    // --------------------------------------------------------
    // GDP lookup
    // --------------------------------------------------------

    const gdpByIso = new Map(
        gdpData.map(d => [
            d.iso3,
            d
        ])
    );


    // --------------------------------------------------------
    // Natural Earth ISO-3
    // --------------------------------------------------------

    function getIso3(feature) {

        const p = feature.properties || {};

        const candidates = [
            p.ISO_A3,
            p.ADM0_A3,
            p.SOV_A3,
            p.WB_A3,
            feature.id
        ];

        for (const code of candidates) {

            if (
                code &&
                /^[A-Za-z]{3}$/.test(
                    code.toString().trim()
                )
            ) {

                return code
                    .toString()
                    .trim()
                    .toUpperCase();
            }
        }

        return "";
    }


    // --------------------------------------------------------
    // Country name
    // --------------------------------------------------------

    function getCountryName(feature) {

        const p = feature.properties || {};

        return (
            p.NAME ||
            p.ADMIN ||
            p.NAME_LONG ||
            "Unknown"
        );
    }


    // --------------------------------------------------------
    // Join GDP into GeoJSON
    // --------------------------------------------------------

    geoData.features.forEach(feature => {

        const iso3 =
            getIso3(feature);

        const row =
            gdpByIso.get(iso3);

        feature.properties.__iso3 =
            iso3;

        feature.properties.__name =
            row
                ? row.country
                : getCountryName(feature);

        feature.properties.__gdp =
            row
                ? row.gdp
                : null;

        feature.properties.__rank =
            row
                ? row.rank
                : null;
    });


    // --------------------------------------------------------
    // Check join
    // --------------------------------------------------------

    const geoCodes =
        new Set(
            geoData.features.map(
                d => d.properties.__iso3
            )
        );

    const unmatched =
        gdpData.filter(
            d => !geoCodes.has(d.iso3)
        );

    console.log(
        "GDP countries:",
        gdpData.length
    );

    console.log(
        "Unmatched GDP countries:",
        unmatched
    );


    geoDataGlobal =
        geoData;


    // --------------------------------------------------------
    // Draw
    // --------------------------------------------------------

    drawChoropleth(
        geoData
    );

    drawCartogram(
        geoData
    );

})
.catch(error => {

    console.error(
        "Error loading Lab 9:",
        error
    );

});


// ============================================================
// CHOROPLETH
// ============================================================

function drawChoropleth(geoData) {


    const container =
        document.getElementById(
            "choropleth"
        );


    const width =
        Math.max(
            500,
            Math.round(
                container
                    .getBoundingClientRect()
                    .width
            )
        );


    // --------------------------------------------------------
    // Remove Antarctica
    // --------------------------------------------------------

    const mapGeoData = {

        type: "FeatureCollection",

        features:
            geoData.features.filter(
                d =>
                    d.properties.__iso3 !==
                    "ATA"
            )
    };


    // --------------------------------------------------------
    // SVG
    // --------------------------------------------------------

    d3.select("#choropleth")
        .html("");


    choroplethSvg =
        d3.select("#choropleth")

        .append("svg")

        .attr(
            "viewBox",
            `0 0 ${width} ${MAP_HEIGHT}`
        );


    const mapGroup =
        choroplethSvg
        .append("g");


    // --------------------------------------------------------
    // Projection
    // --------------------------------------------------------

    const projection =
        d3.geoNaturalEarth1();


    projection.fitExtent(

        [
            [8, 8],
            [
                width - 8,
                MAP_HEIGHT - 8
            ]
        ],

        mapGeoData
    );


    const path =
        d3.geoPath()
        .projection(projection);


    // --------------------------------------------------------
    // GDP range
    // --------------------------------------------------------

    const gdpValues =
        mapGeoData.features

        .map(
            d =>
                d.properties.__gdp
        )

        .filter(
            d =>
                d != null &&
                d > 0
        );


    const minGDP =
        d3.min(gdpValues);

    const maxGDP =
        d3.max(gdpValues);


    // --------------------------------------------------------
    // Log color scale
    // --------------------------------------------------------

    const colorScale =
        d3.scaleSequentialLog(
            d3.interpolateBlues
        )

        .domain([
            minGDP,
            maxGDP
        ]);


    // --------------------------------------------------------
    // Draw countries
    // --------------------------------------------------------

    choroplethCountries =
        mapGroup

        .selectAll(".country")

        .data(
            mapGeoData.features
        )

        .join("path")

        .attr(
            "class",
            "country"
        )

        .attr(
            "d",
            path
        )

        .attr(
            "fill",
            d => {

                const gdp =
                    d.properties.__gdp;

                return gdp == null
                    ? noDataColor
                    : colorScale(gdp);
            }
        )

        .attr(
            "stroke",
            "white"
        )

        .attr(
            "stroke-width",
            0.7
        );


    // --------------------------------------------------------
    // Hover
    // --------------------------------------------------------

    choroplethCountries

        .on(
            "mouseover",
            function(event, d) {

                d3.select(this)
                    .attr(
                        "stroke",
                        "#111"
                    )
                    .attr(
                        "stroke-width",
                        2
                    );


                const gdp =
                    d.properties.__gdp;


                let content;


                if (gdp == null) {

                    content = `
                        <strong>
                            ${d.properties.__name}
                        </strong>
                        <br>
                        GDP: No data
                        <br>
                        <small>
                            Outside provided top-50 dataset
                        </small>
                    `;

                } else {

                    content = `
                        <strong>
                            ${d.properties.__name}
                        </strong>
                        <br>
                        GDP:
                        $${formatGDP(gdp)} billion
                        <br>
                        Rank:
                        ${d.properties.__rank}
                    `;
                }


                tooltip
                    .style(
                        "display",
                        "block"
                    )
                    .html(
                        content
                    );
            }
        )


        .on(
            "mousemove",
            function(event) {

                tooltip
                    .style(
                        "left",
                        `${event.clientX + 12}px`
                    )
                    .style(
                        "top",
                        `${event.clientY + 12}px`
                    );
            }
        )


        .on(
            "mouseout",
            function(event, d) {

                tooltip
                    .style(
                        "display",
                        "none"
                    );


                d3.select(this)

                    .attr(
                        "stroke",
                        d.properties.__iso3 ===
                        selectedIso
                            ? selectedColor
                            : "white"
                    )

                    .attr(
                        "stroke-width",
                        d.properties.__iso3 ===
                        selectedIso
                            ? 3
                            : 0.7
                    );
            }
        )


        .on(
            "click",
            function(event, d) {

                event.stopPropagation();

                selectCountry(
                    d.properties.__iso3
                );
            }
        );


    // --------------------------------------------------------
    // Zoom / pan
    // --------------------------------------------------------

    choroplethZoom =
        d3.zoom()

        .scaleExtent([
            1,
            8
        ])

        .on(
            "zoom",
            event => {

                mapGroup.attr(
                    "transform",
                    event.transform
                );
            }
        );


    choroplethSvg
        .call(
            choroplethZoom
        )
        .on(
            "dblclick.zoom",
            null
        );


    // --------------------------------------------------------
    // Reset
    // --------------------------------------------------------

    d3.select(
        "#reset-choropleth"
    )

    .on(
        "click",
        () => {

            choroplethSvg

                .transition()

                .duration(250)

                .call(
                    choroplethZoom.transform,
                    d3.zoomIdentity
                );
        }
    );


    drawLegend(
        colorScale,
        minGDP,
        maxGDP
    );
}


// ============================================================
// CHOROPLETH LEGEND
// ============================================================

function drawLegend(
    colorScale,
    minGDP,
    maxGDP
) {


    d3.select(
        "#choropleth-legend"
    )
    .html("");


    const width = 470;
    const height = 70;

    const barX = 18;
    const barWidth = 290;


    const svg =
        d3.select(
            "#choropleth-legend"
        )

        .append("svg")

        .attr(
            "viewBox",
            `0 0 ${width} ${height}`
        );


    const defs =
        svg.append("defs");


    const gradient =
        defs

        .append(
            "linearGradient"
        )

        .attr(
            "id",
            "gdp-gradient"
        )

        .attr(
            "x1",
            "0%"
        )

        .attr(
            "x2",
            "100%"
        );


    d3.range(
        0,
        1.01,
        0.05
    )
    .forEach(t => {


        const value =
            minGDP *
            Math.pow(
                maxGDP / minGDP,
                t
            );


        gradient

            .append("stop")

            .attr(
                "offset",
                `${t * 100}%`
            )

            .attr(
                "stop-color",
                colorScale(value)
            );
    });


    svg.append("text")

        .attr("x", barX)

        .attr("y", 14)

        .attr(
            "font-size",
            12
        )

        .text(
            "2025 GDP (billion USD, logarithmic color scale)"
        );


    svg.append("rect")

        .attr(
            "x",
            barX
        )

        .attr(
            "y",
            23
        )

        .attr(
            "width",
            barWidth
        )

        .attr(
            "height",
            12
        )

        .attr(
            "fill",
            "url(#gdp-gradient)"
        );


    const middleGDP =
        Math.sqrt(
            minGDP *
            maxGDP
        );


    svg.append("text")

        .attr(
            "x",
            barX
        )

        .attr(
            "y",
            51
        )

        .attr(
            "font-size",
            10
        )

        .text(
            `$${formatGDP(minGDP)}B`
        );


    svg.append("text")

        .attr(
            "x",
            barX +
            barWidth / 2
        )

        .attr(
            "y",
            51
        )

        .attr(
            "text-anchor",
            "middle"
        )

        .attr(
            "font-size",
            10
        )

        .text(
            `$${formatGDP(middleGDP)}B`
        );


    svg.append("text")

        .attr(
            "x",
            barX +
            barWidth
        )

        .attr(
            "y",
            51
        )

        .attr(
            "text-anchor",
            "end"
        )

        .attr(
            "font-size",
            10
        )

        .text(
            `$${formatGDP(maxGDP)}B`
        );


    svg.append("rect")

        .attr(
            "x",
            330
        )

        .attr(
            "y",
            23
        )

        .attr(
            "width",
            12
        )

        .attr(
            "height",
            12
        )

        .attr(
            "fill",
            noDataColor
        )

        .attr(
            "stroke",
            "#aaa"
        );


    svg.append("text")

        .attr(
            "x",
            349
        )

        .attr(
            "y",
            33
        )

        .attr(
            "font-size",
            10
        )

        .text(
            "No data"
        );
}


// ============================================================
// NON-CONTIGUOUS CARTOGRAM
// ============================================================

function drawCartogram(geoData) {


    // --------------------------------------------------------
    // Hide old loading message
    // --------------------------------------------------------

    d3.select(
        "#cartogram-loading"
    )
    .style(
        "display",
        "none"
    );


    const container =
        document.getElementById(
            "cartogram"
        );


    const width =
        Math.max(
            500,
            Math.round(
                container
                    .getBoundingClientRect()
                    .width
            )
        );


    // --------------------------------------------------------
    // Remove Antarctica
    // --------------------------------------------------------

    const mapGeoData = {

        type:
            "FeatureCollection",

        features:
            geoData.features.filter(
                d =>
                    d.properties.__iso3 !==
                    "ATA"
            )
    };


    // --------------------------------------------------------
    // Top-50 economies only
    // --------------------------------------------------------

    const gdpFeatures =
        mapGeoData.features.filter(
            d =>
                d.properties.__gdp != null &&
                d.properties.__gdp > 0
        );


    // --------------------------------------------------------
    // SVG
    // --------------------------------------------------------

    d3.select("#cartogram")
        .html("");


    const svg =
        d3.select("#cartogram")

        .append("svg")

        .attr(
            "viewBox",
            `0 0 ${width} ${MAP_HEIGHT}`
        )

        .style(
            "width",
            "100%"
        )

        .style(
            "height",
            "100%"
        );


    const mapGroup =
        svg.append("g");


    // --------------------------------------------------------
    // Projection
    // --------------------------------------------------------

    const projection =
        d3.geoNaturalEarth1();


    projection.fitExtent(

        [
            [8, 8],

            [
                width - 8,
                MAP_HEIGHT - 8
            ]
        ],

        mapGeoData
    );


    const path =
        d3.geoPath()
        .projection(
            projection
        );


    // ========================================================
    // REFERENCE GEOGRAPHY
    //
    // This shows the original country sizes underneath.
    // ========================================================

    mapGroup

        .selectAll(
            ".reference-country"
        )

        .data(
            mapGeoData.features
        )

        .join("path")

        .attr(
            "class",
            "reference-country"
        )

        .attr(
            "d",
            path
        )

        .attr(
            "fill",
            d =>
                d.properties.__gdp == null
                    ? noDataColor
                    : "#fafafa"
        )

        .attr(
            "stroke",
            "#c7c7c7"
        )

        .attr(
            "stroke-width",
            0.5
        )

        .attr(
            "pointer-events",
            "none"
        );


    // ========================================================
    // TARGET AREA
    //
    // Each GDP country's final area is proportional to GDP.
    // ========================================================

    const totalGDP =
        d3.sum(
            gdpFeatures,
            d =>
                d.properties.__gdp
        );


    /*
        Total visual area occupied by the resized economies.

        0.22 works well for a world map:
        large enough to show strong change without making
        everything overlap excessively.
    */

    const targetTotalArea =
        width *
        MAP_HEIGHT *
        0.22;


    // --------------------------------------------------------
    // Calculate each country's required scale
    // --------------------------------------------------------

    gdpFeatures.forEach(d => {


        const originalArea =
            Math.max(
                path.area(d),
                0.0001
            );


        const targetArea =
            (
                d.properties.__gdp /
                totalGDP
            ) *
            targetTotalArea;


        /*
            Area changes with scale squared.

            targetArea =
                originalArea * scale^2

            therefore:

            scale =
                sqrt(targetArea / originalArea)
        */

        d.properties.__cartogramScale =
            Math.sqrt(
                targetArea /
                originalArea
            );


        d.properties.__cartogramCentroid =
            path.centroid(d);

    });


    // ========================================================
    // DRAW GDP COUNTRIES
    // ========================================================

    cartogramCountries =
        mapGroup

        .selectAll(
            ".cartogram-country"
        )

        .data(
            gdpFeatures
        )

        .join("path")

        .attr(
            "class",
            "cartogram-country"
        )

        .attr(
            "d",
            path
        )

        .attr(
            "fill",
            cartogramColor
        )

        .attr(
            "stroke",
            "white"
        )

        .attr(
            "stroke-width",
            0.8
        )

        /*
            Keep border width visually constant when a country
            is heavily enlarged or shrunk.
        */

        .attr(
            "vector-effect",
            "non-scaling-stroke"
        );


    // ========================================================
    // ANIMATE FROM NORMAL GEOGRAPHY TO CARTOGRAM
    //
    // This makes the area change extremely easy to see.
    // ========================================================

    cartogramCountries

        .transition()

        .duration(
            1200
        )

        .ease(
            d3.easeCubicInOut
        )

        .attr(
            "transform",
            d => {


                const [
                    x,
                    y
                ] =
                    d.properties
                    .__cartogramCentroid;


                const scale =
                    d.properties
                    .__cartogramScale;


                return `
                    translate(${x},${y})
                    scale(${scale})
                    translate(${-x},${-y})
                `;
            }
        );


    // ========================================================
    // TOOLTIP + CLICK
    // ========================================================

    cartogramCountries

        .on(
            "mouseover",
            function(event, d) {


                d3.select(this)

                    .attr(
                        "stroke",
                        "#111"
                    )

                    .attr(
                        "stroke-width",
                        2
                    );


                tooltip

                    .style(
                        "display",
                        "block"
                    )

                    .html(`
                        <strong>
                            ${d.properties.__name}
                        </strong>
                        <br>
                        GDP:
                        $${formatGDP(
                            d.properties.__gdp
                        )} billion
                        <br>
                        Rank:
                        ${d.properties.__rank}
                        <br>
                        <small>
                            Area represents GDP
                        </small>
                    `);
            }
        )


        .on(
            "mousemove",
            function(event) {

                tooltip

                    .style(
                        "left",
                        `${event.clientX + 12}px`
                    )

                    .style(
                        "top",
                        `${event.clientY + 12}px`
                    );
            }
        )


        .on(
            "mouseout",
            function(event, d) {


                tooltip
                    .style(
                        "display",
                        "none"
                    );


                d3.select(this)

                    .attr(
                        "stroke",
                        d.properties.__iso3 ===
                        selectedIso
                            ? selectedColor
                            : "white"
                    )

                    .attr(
                        "stroke-width",
                        d.properties.__iso3 ===
                        selectedIso
                            ? 3
                            : 0.8
                    );
            }
        )


        .on(
            "click",
            function(event, d) {


                event.stopPropagation();


                selectCountry(
                    d.properties.__iso3
                );
            }
        );


    // ========================================================
    // ZOOM / PAN
    // ========================================================

    const zoom =
        d3.zoom()

        .scaleExtent([
            1,
            8
        ])

        .on(
            "zoom",
            event => {

                mapGroup.attr(
                    "transform",
                    event.transform
                );
            }
        );


    svg
        .call(
            zoom
        )
        .on(
            "dblclick.zoom",
            null
        );


    // --------------------------------------------------------
    // Debug
    // --------------------------------------------------------

    console.log(
        "Cartogram GDP countries:",
        gdpFeatures.length
    );


    console.log(
        "Total GDP:",
        totalGDP
    );


    console.log(
        "Cartogram scale range:",
        d3.extent(
            gdpFeatures,
            d =>
                d.properties
                .__cartogramScale
        )
    );
}


// ============================================================
// LINKED HIGHLIGHTING
// ============================================================

function selectCountry(iso) {


    if (
        selectedIso === iso
    ) {

        selectedIso =
            null;

    } else {

        selectedIso =
            iso;
    }


    updateHighlight();
}


// ============================================================
// UPDATE BOTH MAPS
// ============================================================

function updateHighlight() {


    // --------------------------------------------------------
    // Choropleth
    // --------------------------------------------------------

    if (
        choroplethCountries
    ) {

        choroplethCountries

            .attr(
                "stroke",
                d =>
                    d.properties.__iso3 ===
                    selectedIso
                        ? selectedColor
                        : "white"
            )

            .attr(
                "stroke-width",
                d =>
                    d.properties.__iso3 ===
                    selectedIso
                        ? 3
                        : 0.7
            );
    }


    // --------------------------------------------------------
    // Cartogram
    // --------------------------------------------------------

    if (
        cartogramCountries
    ) {

        cartogramCountries

            .attr(
                "fill",
                d =>
                    d.properties.__iso3 ===
                    selectedIso
                        ? selectedColor
                        : cartogramColor
            )

            .attr(
                "stroke",
                d =>
                    d.properties.__iso3 ===
                    selectedIso
                        ? selectedColor
                        : "white"
            )

            .attr(
                "stroke-width",
                d =>
                    d.properties.__iso3 ===
                    selectedIso
                        ? 3
                        : 0.8
            );
    }


    // --------------------------------------------------------
    // Selected-country text
    // --------------------------------------------------------

    let countryName =
        "None";


    if (
        selectedIso &&
        geoDataGlobal
    ) {

        const feature =
            geoDataGlobal.features.find(
                d =>
                    d.properties.__iso3 ===
                    selectedIso
            );


        if (
            feature
        ) {

            countryName =
                feature
                .properties
                .__name;
        }
    }


    d3.select(
        "#selected-country"
    )
    .text(
        countryName
    );
}