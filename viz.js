// Keep all movies information after loading
var movies;
var minYear, maxYear;
// Keep track of number of generes into the set of movies
var genres = [];
// Load movies file
d3.tsv('data/movies.tsv', function(error, data) {
    if(error) throw error;
    // Load metatada file
    d3.tsv('data/metadata.tsv', function(error, metadata) {
        if(error) throw error;

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
            d.positioned = false;
            d.visited = false;
            d.actors = metadata[index]['actors'];
            d.X = 0;
            d.Y = 0;
            d.width = 0;
            d.height = 0;
            d.year = Number(d.year);
            d.runtime = metadata[index]['runtime'];
            d.lang = metadata[index]['language'];
            d.released = metadata[index]['released'];
            d.country = metadata[index]['country'];
            d.imdbRating = metadata[index]['imdbRating'];
            d.plot = metadata[index]['plot'];
            if (metadata[index]['genre'] != undefined) {
                d.genre = metadata[index]['genre'].toLowerCase().split(', ');
                d.genString = metadata[index]['genre'];
                for (var i = 0; i < d.genre.length; i++) {
                    if (genres.indexOf(d.genre[i]) == -1) {
                        genres.push(d.genre[i]);
                    }
                }
            } else {
                d.genre = undefined;
                d.genString = undefined;
            }
        });

        //delete genres[genres.indexOf("N/A")];
        var numberOfGenres = genres.length-1;

        // Filter all films and take only the best, with score > 20
        data = data.filter((d) => { return d.score > 20; })
                .sort((a, b) => { return b.score - a.score; });
        numberOfFilms = data.length;
        data.forEach((d) => { d.index = data.indexOf(d); });

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
                similarity[i][j] = (0.3*similarity[i][j] + 0.7*commonGenres / numberOfGenres);
                similarity[j][i] = similarity[i][j];
            }
        }

        // Create a list of similar movies in each movie field
        for (var i = 0; i < similarity.length; i++) {
            var similar = [];
            for (var j = 0; j < similarity.length; j++) {
                if (i == j) continue;
                if (similarity[i][j] != 0) {
                    similar.push({'index': data[j].index, 'sim': similarity[i][j]});
                }
            }
            data[i].similar = similar;
        }

        // For each movie takes only the first 'howMany' similar
        var howMany = 5;
        data.forEach((d) => {
            var toDelete = d.similar.length - howMany;
            d.similar.sort((a, b) => { return b.sim - a.sim; })
                .splice(-toDelete, toDelete);
        });

        //Add check button for genres
        var enter = d3.select('#genresBox').selectAll('label')
            .data(genres)
            .enter().append('div')
            .attr('class', 'checkbox');

        enter.append('input')
            .attr('type', 'checkbox')
            .attr('name', 'genre')
            .attr('id', (g) => { return String(g).toLowerCase(); })
            .attr('value', (g) => { return String(g).toLowerCase(); })
            .on("change", function() {
                if (this.checked == true) {
                    addConstraint(this.value);
                } else {
                    removeConstraint(this.value);
                }
            });
        enter.append('label')
            .attr('for', (g) => { return String(g).toLowerCase(); })
            .text(String);

        // Take svg container from index.html
        var svg = d3.select('svg');
        //var width = svg.attr('width');
        //var height = svg.attr('height');
        var width = svg.node().getBoundingClientRect().width;
        var height = svg.node().getBoundingClientRect().height;

        var totalArea = width*height/1.8;
        // covered array keep track of movies already vizualized in order to
        // know witch area of the screen is already covered
        var covered = [];

        for (var z = 0; z < data.length; z++) {
            var movie = data[z];
            // Skip if movie already visualizied
            if (movie.positioned == true) continue;
            // Compute the height and width value depending on movie score
            var movieArea = Math.floor(totalArea * movie.score / totalScore);
            movie.width = Math.round(6 * Math.sqrt(movieArea / 54));
            movie.height =  Math.round(9 * Math.sqrt(movieArea / 54));

            if (z == 0) {
                // Place first element in the middle of the canvas
                movie.X = (width/2) - (movie.width/2);
                movie.Y = (height/2) - (movie.height/2);
            } else {
                // Check if one of my similar has already be visualized
                for (var i = 0; i < movie.similar.length; i++) {
                    var m = data[movie.similar[i].index];
                    if (m.positioned == true) {
                        // If yes, find a position around it
                        findPositionAround(m, movie);
                        if (movie.findAPlace == true) break;
                    }
                }
                if (movie.findAPlace == false) { // Not already find a position
                    findRandomPosition(movie);
                }
            }
            // Add movie to visualization
            placeMovie(movie);

            placeSimilar(movie);
        }

        movies = data;
        /* // Not useful for this version
        minYear = movies.map((m) => { return m.year; })
                            .reduce((min, y) => { return y < min ? y : min; }, 2020);
        maxYear = movies.map((m) => { return m.year; })
                            .reduce((max, y) => { return y > max ? y : max; }, 0);
        */

        // Add basic zoom features
        var zoom = d3.zoom()
            // scale range: from 1 (default size) to 15 times big
            .scaleExtent([0.95, 15])
            .on('zoom', function () {
                d3.select('svg')
                    .select('g')
                    .attr('transform', 'translate(' + d3.event.transform.x + ',' + d3.event.transform.y + ') scale(' + d3.event.transform.k + ')');
            });

        d3.select('svg').call(zoom);

        d3.select('button#clear').on('click', function(){

        });

        function callPopup() {
            // Add all informations to the popup
            $modal = $('.modal-frame');
            $overlay = $('.modal-overlay');
            // Find the right movie into data
            var m = movies.find((d) => { return d.id == this.id; });
            // Select popup
            var popup = d3.select('.modal-body');
            // Fill informations
            popup.select('#poster').attr('src', m.poster);
            popup.select('#title').text(m.title);
            popup.select('#year').text(m.year);
            popup.select('#genres').text(m.genString);
            popup.select('#duration').text(m.runtime);
            popup.select('#country').text(m.country);
            popup.select('#rank1').text('Top100: '+(m.index+1));
            popup.select('#rank2').text('IMDb: ' + m.imdbRating);
            popup.select('#plot').text(m.plot);
            popup.select('#director').html('<strong>Director</strong>: '+m.director);
            popup.select('#language').html('<strong>Language</strong>: '+m.lang);
            popup.select('#released').html('<strong>Released on</strong> '+m.released);
            popup.select('#actors').text('Actors: '+m.actors);
            for (var h = 0; h < m.similar.length; h++) {
                popup.select('#similar'+(h+1))
                    .attr('src', movies[m.similar[h].index].poster)
                    .attr('class', 'img-thumbnail'); // Add movie-img to seem clickable
                    //.attr('id', movies[m.similar[h].index].id);
                    //.on("click", callPopup);
            }
            // Show Popup
            $overlay.addClass('state-show');
            $modal.removeClass('state-leave').addClass('state-appear');
        }

        // Add popup-on-click feature
        d3.select('svg').select('g').selectAll('rect.movie').on("click", callPopup);

        function placeSimilar(movie) {
            for (var i = 0; i < movie.similar.length; i++) {
                // Takes a similar movie
                var m = data[movie.similar[i].index];
                // Skip if movie already visualizied
                if (m.positioned == true) continue;
                // Find a possible position
                findPositionAround(movie, m);
                if (m.findAPlace == true) {
                    // Add movie to visualization
                    placeMovie(m);
                }
            }
            movie.visited = true;
            for (var i = 0; i < movie.similar.length; i++) {
                // Takes a similar movie
                var m = data[movie.similar[i].index];
                // Skip if movie already visited
                if (m.visited == true) continue;
                // Visualize similar of m
                placeSimilar(m);
            }
        }

        function findPositionAround(movie, m) {
            // Evaluate center of circumference of the movie
            var cx = movie.X + movie.width/2;
            var cy = movie.Y + movie.height/2;

            // Compute the height and width value depending on movie score
            var mArea = Math.floor(totalArea * m.score / totalScore);
            m.width = Math.round(6 * Math.sqrt(mArea / 54));
            m.height =  Math.round(9 * Math.sqrt(mArea / 54));

            // Evaluate radius
            var minDist = Math.sqrt(movie.width*movie.width + movie.height*movie.height)/2 + Math.sqrt(m.width*m.width + m.height*m.height)/2
            var r = minDist; //+ 10/sim;
            var v = 1;

            while (!m.findAPlace) {
                if (v > 10) { // Try a certain number of times
                    m.findAPlace = false;
                    break;
                }
                // This formula takes a random X in the diameter of the circunference around the movie
                m.X = Math.random()*2*r + cx - r;
                // Evaluate the corresponding Y
                var aux = m.X - cx;
                m.Y = cy - (1-2*((v++)%2))*Math.sqrt(r*r - aux*aux);
                if (isNaN(m.Y)) {
                    m.Y = cy;
                    //m.X = Math.floor(Math.random() * width);
                    //m.Y = Math.floor(Math.random() * height);
                }
                /*
                // Modify m.X in order to be closer to the similar
                aux = Math.abs(m.Y - cy)+1;
                if (m.X - cx >= 0) { // m on the right of movie
                    if (m.X - m.width/2 > cx + movie.width/2) {
                        var dist = m.X - cx - m.width/2 - movie.width/2;
                        m.X -= dist/2 + 2*dist/aux;
                    }
                } else { // m on the left of movie
                    if (m.X + m.width/2 < cx - movie.width/2) {
                        var dist = cx - m.X - m.width/2 - movie.width/2;
                        m.X += dist/2 + 2*dist/aux;
                    }
                }
                */
                m.X -= m.width/2;
                m.Y -= m.height/2;
                // Check and correct x and y for box boundaries
                checkBoundries(m);

                // Check x and y for overlapping
                m.findAPlace = checkOverlapping(m);

            }
        }

        function findRandomPosition(m) {
            do { // Try a lot of times while you find a place that not overlap with others movies
                m.X = Math.floor(Math.random() * width);
                m.Y = Math.floor(Math.random() * height);
                // Check and correct x and y for box boundaries
                checkBoundries(m);
                // Check x and y for overlapping
                m.findAPlace = checkOverlapping(m);
            } while (!movie.findAPlace);
        }

        function checkBoundries(w) {
            var X = w.X, Y = w.Y;
            if (X <= width) {
                if (X + w.width >= width) {
                    X -= width - X + w.width + 1;
                }
                if (X <= 0) {
                    X = 1;
                }
            } else {
                X -= X + w.width - width + 1;
            }
            if (Y <= height) {
                if (Y + w.height >= height) {
                    Y -= height - Y + w.height + 1;
                }
                if (Y <= 0) {
                    Y = 1;
                }
            } else {
                Y -= Y + w.height - height + 1;
            }
            w.X = X; w.Y = Y;
        }

        function checkOverlapping(m) {
            var check = true;
            for (var j = 0; j < covered.length; j++) {
                var x = covered[j]['x'];
                var y = covered[j]['y'];
                var w = covered[j]['w'];
                var h = covered[j]['h'];
                if (m.X < x && m.X + m.width >= x) {
                    if (m.Y < y && m.Y + m.height >= y) {
                        check = false;
                    }
                    if (m.Y >= y && m.Y <= y + h && m.Y + m.height >= y) {
                        check = false;
                    }
                }
                if (m.X >= x && m.X <= x + w && m.X + m.width >= x) {
                    if (m.Y < y && m.Y + m.height >= y) {
                        check = false;
                    }
                    if (m.Y >= y && m.Y <= y + h && m.Y + m.height >= y) {
                        check = false;
                    }
                }
            }
            return check;
        }

        function placeMovie(m) {
            // Add movie to covered array
            covered.push({'x': m.X, 'y': m.Y, 'w': m.width, 'h': m.height});

            svg.select('g')
                .append('defs')
                .append('pattern')
                .attr('id', m.id)
                .attr('patternUnits', 'userSpaceOnUse')
                .attr('x', m.X)
                .attr('y', m.Y)
                .attr('width', m.width)
                .attr('height', m.height)
                .append('image')
                .attr('xlink:href', m.poster)
                .attr('width', m.width)
                .attr('height', m.height);

            svg.select('g')
                .append('rect')
                .attr('x', m.X)
                .attr('y', m.Y)
                .attr('width', m.width)
                .attr('height', m.height)
                .attr('id', m.id)
                .attr('fill', 'url(#' + m.id + ')')
                .attr('class', 'movie open');

            m.positioned = true;
        }
    });
});

// Add all interaction features for filters
var canvas = d3.select('svg').select('g');
var search = "";
var constraints = [];

// Add slider for years
$(function() {
    $("#slider-years").slider({
        range: true,
        min: 2000,
        max: 2016,
        values: [2000, 2016],
        slide: function( event, ui ) {
            $("#years").val(ui.values[0]+" - "+ui.values[1]);
            minYear = ui.values[0];
            maxYear = ui.values[1];
            evaluateConstraints();
        }
    });
    $("#years").val(
        $("#slider-years").slider("values", 0)+" - "+$("#slider-years").slider("values", 1)
    );
    minYear = 2000;
    maxYear = 2016;
});

d3.select("#searchField").on("change keyup", function() {
    // Take value from searchField and filter
    search = this.value.toLowerCase();
    evaluateConstraints();
});

d3.selectAll('input[name="criteria"]').on("click", function() {
    // Ecaluate filters
    evaluateConstraints();
});

$(document).on('ready', function(){
    $modal = $('.modal-frame');
    $overlay = $('.modal-overlay');

    /* Need this to clear out the keyframe classes so they dont clash with each other between ener/leave. Cheers. */
    $modal.bind('webkitAnimationEnd oanimationend msAnimationEnd animationend', function(e){
      if($modal.hasClass('state-leave')) {
        $modal.removeClass('state-leave');
      }
    });

    $('.close').on('click', function(){
      $overlay.removeClass('state-show');
      $modal.removeClass('state-appear').addClass('state-leave');
    });
  });

function addConstraint(constr) {
    // Add a new constraint and filter
    constraints.push(constr);
    evaluateConstraints();
}

function removeConstraint(constr) {
    // Remove a constraint and filter
    constraints.splice(constraints.indexOf(constr), 1);
    evaluateConstraints();
}

function evaluateConstraints() {
    movies.forEach((m) => {
        if(search == "" && constraints.length == 0 && minYear == 2000 && maxYear == 2016) {
            d3.selectAll('#'+m.id).attr('opacity', 1);
            return;
        }
        var opacity = 1;
        var match1 = false, match2 = true, match3 = true;
        var crit = d3.select('input[name="criteria"]:checked').node().value;
        switch (crit) {
            case "title": match1 = m.title.toLowerCase().startsWith(search);
                break;
            case "director": match1 = m.director.toLowerCase().includes(search);
                break;
            case "actor": match1 = m.actors.toLowerCase().includes(search);
                break;
            default: break;
        }
        match2 = constraints.every((c) => {
            return m.genre.indexOf(c) != -1;
        });
        match3 = (m.year >= minYear && m.year <= maxYear) ? true : false;
        // If doesn't match, change opacity
        if (!(match1 && match2 && match3)) {
            opacity = 0.1;
        }
        d3.selectAll('#'+m.id).attr('opacity', opacity);
    })
}
