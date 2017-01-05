
var numberOfFilms = 100;

var body = d3.select("body");

// Create the similarity matrix
var similarity = new Array(numberOfFilms);
for (var i = 0; i < numberOfFilms; i++) {
    similarity[i] = new Array(numberOfFilms);
}

// Load movies data
d3.tsv("data/movies.tsv", function(error, data) {
    if(error) throw error;

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

    // compute the similarity matrix
    for (var i = 0; i < numberOfFilms; i++) {
        similarity[i][i] = 1;
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
        }
    }

    body.selectAll('.movie')
        .data(data
            .filter(function(d) { return d.score > 20; })
            .sort(function(a, b) { return b.score - a.score; })
        )
        .enter().append('div')
            .text(function(d) { return d.title; });
});
