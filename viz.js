
// Create array of links
var links = [];
var nodes = [];

// Load movies data
d3.tsv('data/movies.tsv', function(error, data) {
    if(error) throw error;

    var numberOfFilms = data.length;

    // Create the similarity matrix
    var similarity = new Array(numberOfFilms);
    for (var i = 0; i < numberOfFilms; i++) {
        similarity[i] = new Array(numberOfFilms);
    }

    // compute some statistic while loading
    data.forEach(function(d) {
        var score = 0;
        var critics = [];
        for(var i=0; i<177; i++) {
            critic = 'c'+d3.format('03')(i+1);
            rank = d[critic];
            if(rank > 0) {
                score += 11 - rank;
                critics.push(critic);
            }
        }
        d.score = score;
        d.critics = critics;
    });

    data = data.filter(function(d) { return d.score > 20; });
    numberOfFilms = data.length;

    // compute the similarity matrix
    for (var i = 0; i < numberOfFilms; i++) {
        similarity[i][i] = 1;
        nodes.push({'id': data[i].title, 'score': data[i].score})
        for (var j = i+1; j < numberOfFilms; j++) {
            list1 = data[i]['critics'];
            list2 = data[j]['critics'];
            commonCritics = 0;
            for (var x = 0, y = 0; x < list1.length && y < list2.length;) {
                if (list1[x] > list2[y]) {
                    y++;
                } else if (list1[x] < list2[y]) {
                    x++;
                } else {
                    x++;
                    y++;
                    commonCritics++;
                }
            }
            similarity[i][j] = commonCritics / Math.max(list1.length, list2.length);
            similarity[j][i] = similarity[i][j];
            if (similarity[i][j] != 0) {
                links.push({'source': data[i].title, 'target': data[j].title, 'value': similarity[i][j]});
            } /*else {
                links.push({'source': data[i].title, 'target': data[j].title, 'value': 0.01});
            }*/
        }
    }

    console.log(nodes.length + ' ' + links.length);

    var svg = d3.select('svg'),
    width = svg.attr('width'),
    height = svg.attr('height');

    var simulation = d3.forceSimulation()
        .force("link", d3.forceLink()
            .id(function(d) { return d.id; })
            .distance(function(d) { return 20/d.value; })
        )
        .force("charge", d3.forceManyBody().strength(-40))
        .force("center", d3.forceCenter(width / 2, height / 2));

    var link = svg.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(links)
        .enter().append('line');

    var node = svg.append('g')
        .attr('class', 'nodes')
        .selectAll('circle')
        .data(nodes)
        .enter().append('circle')
        //.attr('r', function(n) { return n.score; })
        .attr('r', 5)
        .attr('fill', 'black')
        //.call(d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended))
        ;

    simulation.nodes(nodes)
        .on('tick', ticked);

    simulation.force('link')
        .links(links);

    function ticked() {
        link
            .attr('x1', function(d) { return d.source.x; })
            .attr('y1', function(d) { return d.source.y; })
            .attr('x2', function(d) { return d.target.x; })
            .attr('y2', function(d) { return d.target.y; });

        node
            .attr('cx', function(d) { return d.x; })
            .attr('cy', function(d) { return d.y; });
    }

    /*body.selectAll('.movie')
        .data(data
            .filter(function(d) { return d.score > 20; })
            .sort(function(a, b) { return b.score - a.score; })
        )
        .enter().append('div')
            .text(function(d) { return d.title; });*/
});
