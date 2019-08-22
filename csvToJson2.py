import csv

# Read in raw data from csv
rawData = csv.reader(open('resurety.csv', 'rb'), dialect='excel')

# the template. where data from the csv will be formatted to geojson
template = \
    ''' \
    { "type" : "Feature",
        "id" : %s,
            "geometry" : {
                "type" : "Point",
                "coordinates" : ["%s","%s"]},
        "properties" : { "name" : "%s", "value" : "%s"}
        },
    '''

# the head of the geojson file
output = \
    ''' \
{ "type" : "Feature Collection",
    {"features" : [
    '''

# loop through the csv by row skipping the first
iter = 0
for row in rawData:
    iter += 1
    if iter >= 2:
        id = row[1]
        lat = row[3]
        lon = row[4]
        name = row[2]
        pop = row[5]
        output += template % (row[0], row[2], row[1], row[3], row[4])

# the tail of the geojson file
output += \
    ''' \
    ]
}
    '''

# opens an geoJSON file to write the output to
outFileHandle = open("points.geojson", "w")
outFileHandle.write(output)
outFileHandle.close()