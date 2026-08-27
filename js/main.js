d3.csv("data/students.csv", d => {

    return {
        name: d.name,
        score: +d.score
    };

}).then(data => {

    console.log(data);

});


d3.json("data/students.json")
    .then(data => {

        console.log(data);

    });