
// Load movies file
d3.tsv('data/movies.tsv', function(error, data) {
    if(error) throw error;
    // Load metatada file
    d3.tsv('data/metadata.tsv', function(error, metadata) {
        if(error) throw error;

        // Keep track of number of generes into the set of movies
        var genres = [];

        // Compute some statistic
        data.forEach(function(d) {
            var score = 0;
            var critics = [];
            var index = data.indexOf(d);
            for(var i=0; i<177; i++) {
                critic = 'c'+d3.format('03')(i+1);
                rank = d[critic];
                if(rank > 0) {
                    score += 11 - rank;
                    critics.push({'critic': critic, 'rank': rank});
                }
                delete d[critic];
            }
            d.score = score;
            d.critics = critics;
            d.poster = metadata[index]['poster'];
            if (metadata[index]['genre'] != undefined) {
                d.genre = metadata[index]['genre'].split(', ');
                for (var i = 0; i < d.genre.length; i++) {
                    if (genres.indexOf(d.genre[i]) == -1) {
                        genres.push(d.genre[i]);
                    }
                }
            } else {
                d.genre = undefined;
            }
        });

        delete genres[genres.indexOf("N/A")];
        var numberOfGenres = genres.length;

        // Filter all films and take only the best, with score > 20
        data = data.filter(function(d) { return d.score > 20; });
        numberOfFilms = data.length;

        // Create the similarity matrix
        var similarity = new Array(numberOfFilms);
        for (var i = 0; i < numberOfFilms; i++) {
            similarity[i] = new Array(numberOfFilms);
        }

        // Compute the total score in order to make after the proportion for the covered area
        var totalScore = 0;

        // Compute the similarity matrix
        for (var i = 0; i < numberOfFilms; i++) {
            similarity[i][i] = 1;
            totalScore += data[i].score;
            // Evaluate similarity for critics vote
            for (var j = i+1; j < numberOfFilms; j++) {
                var list1 = data[i].critics;
                var list2 = data[j].critics;
                var commonCritics = 0;
                for (var x = 0, y = 0; x < list1.length && y < list2.length;) {
                    if (list1[x].critic > list2[y].critic) {
                        y++;
                    } else if (list1[x].critic < list2[y].critic) {
                        x++;
                    } else {
                        x++;
                        y++;
                        commonCritics++;
                    }
                }
                similarity[i][j] = commonCritics / Math.max(list1.length, list2.length);
                similarity[j][i] = similarity[i][j];
            }
            // Evaluate similarity for genres
            if (data[i].genres == undefined) continue;
            for (var j = i+1; j < numberOfFilms; j++) {
                var list1 = data[i].genres;
                var list2 = data[j].genres;
                var commonGenres = 0;
                if (list2 != undefined) {
                    if (list1.length > list2.length) {
                        var min = list1;
                        list1 = list2;
                        list2 = min;
                    }
                    for (var i = 0; i < list1.length; i++) {
                        if (list2.indexOf(list1[i]) != -1) {
                            commonGenres++;
                        }
                    }
                }
                similarity[i][j] = (similarity[i][j] + commonGenres / numberOfGenres) / 2;
                similarity[j][i] = similarity[i][j];
            }
        }

        // Create a list of similar movies in each movie field
        for (var i = 0; i < similarity.length; i++) {
            var similar = [];
            for (var j = 0; j < similarity.length; j++) {
                if (i == j) continue;
                if (similarity[i][j] != 0) {
                    similar.push({'title': data[j].title, 'value': similarity[i][j]});
                }
            }
            data[i].similar = similar;
        }

        // For each movie takes only the first 'howMany' similar
        var howMany = 5;
        data.forEach((d) => {
            var toDelete = d.similar.length - howMany;
            d.similar.sort((a, b) => { return b.value - a.value; })
                //.splice(-toDelete, toDelete);
        });

        // Take svg container from index.html
        var svg = d3.select('svg'),
        width = svg.attr('width'),
        height = svg.attr('height');

        var totalArea = width*height/2.6;
        // covered array keep track of movies already vizualized in order to
        // know witch area of the screen is already covered
        var covered = [];

        data.forEach((d) => {
            // Compute for each movie the high and with value depending on its score
            var movieArea = Math.floor(totalArea * d.score / totalScore);
            var movieWidth = Math.round(6 * Math.sqrt(movieArea / 54));
            var movieHeight =  Math.round(9 * Math.sqrt(movieArea / 54));

            var X, Y, findAPlace;

            do { // Try a lot of times while you find a place that not overlap with others movies
                X = Math.floor(Math.random() * width);
                Y = Math.floor(Math.random() * height);

                // Check and correct x and y for box boundaries
                if (X + movieWidth >= width) {
                    X -= width - X + movieWidth + 1;
                }
                if (X <= 0) {
                    X = 1;
                }
                if (Y + movieHeight >= height) {
                    Y -= height - Y + movieHeight + 1;
                }
                if (Y <= 0) {
                    Y = 1;
                }

                findAPlace = true;

                // Check x and y for overlapping
                for (var i = 0; i < covered.length; i++) {
                    var x = covered[i]['x'];
                    var y = covered[i]['y'];
                    var w = covered[i]['w'];
                    var h = covered[i]['h'];
                    if (X < x && X + movieWidth >= x) {
                        if (Y < y && Y + movieHeight >= y) {
                            findAPlace = false;
                            break;
                        }
                        if (Y >= y && Y <= y + h && Y + movieHeight >= y) {
                            findAPlace = false;
                            break;
                        }
                    }
                    if (X >= x && X <= x + w && X + movieWidth >= x) {
                        if (Y < y && Y + movieHeight >= y) {
                            findAPlace = false;
                            break;
                        }
                        if (Y >= y && Y <= y + h && Y + movieHeight >= y) {
                            findAPlace = false;
                            break;
                        }
                    }
                }
            } while (!findAPlace);

            // Add movie to covered array
            covered.push({'x': X, 'y': Y, 'w': movieWidth, 'h': movieHeight});

            // Add movie to visualization
            svg.select('g')
                .append('defs')
                .append('pattern')
                .attr('id', d.id)
                .attr('patternUnits', 'userSpaceOnUse')
                .attr('x', X)
                .attr('y', Y)
                .attr('width', movieWidth)
                .attr('height', movieHeight)
                .append('image')
                .attr('xlink:href', d.poster)
                .attr('width', movieWidth)
                .attr('height', movieHeight);

            svg.select('g')
                .append('rect')
                .attr('x', X)
                .attr('y', Y)
                .attr('width', movieWidth)
                .attr('height', movieHeight)
                .attr('fill', 'url(#' + d.id + ')')
                .attr('class', 'movie');
        });

        // Add basic zoom features
        svg.append('rect')
            .attr('class', 'zoom-layer')
            .style('fill', 'none')
            .style('pointer-events', 'all')
            .attr('width', width)
            .attr('height', height);

        var zoom = d3.zoom()
            // scale range: from 1 (default size) to 15 times big
            .scaleExtent([1, 15])
            .on('zoom', function () {
                d3.select('svg')
                    .select('g')
                    .attr('transform', 'translate(' + d3.event.transform.x + ',' + d3.event.transform.y + ') scale(' + d3.event.transform.k + ')');
            });

        var zoomrect = d3.select('svg').select('.zoom-layer').call(zoom);
    });

    /*var link = svg.append('g')
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

    body.selectAll('.movie')
        .data(data
            .filter(function(d) { return d.score > 20; })
            .sort(function(a, b) { return b.score - a.score; })
        )
        .enter().append('div')
            .text(function(d) { return d.title; });*/
});
