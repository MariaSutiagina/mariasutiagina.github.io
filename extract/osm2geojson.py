import xml.etree.ElementTree as ET
import sys
import os

def osm_xml_to_geojson(osm_xml_file, output_geojson_file):
    tree = ET.parse(osm_xml_file)
    root = tree.getroot()

    # Parse nodes
    nodes = {}
    for node in root.findall('node'):
        node_id = node.get('id')
        lat = node.get('lat')
        lon = node.get('lon')
        nodes[node_id] = [float(lon), float(lat)]  # GeoJSON uses [longitude, latitude]

    # Parse ways and convert to GeoJSON LineString features
    features = []
    for way in root.findall('way'):
        way_id = way.get('id')
        points = [nodes[nd.get('ref')] for nd in way.findall('nd')]
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": points
            },
            "properties": {
                "id": way_id,
                "tags": {tag.get('k'): tag.get('v') for tag in way.findall('tag')}
            }
        }
        features.append(feature)

    # Construct GeoJSON
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }

    # Write GeoJSON to file
    with open(output_geojson_file, 'w') as f:
        f.write(json.dumps(geojson, indent=2))

if __name__ == "__main__":
    import json
    if len(sys.argv) != 2:
        print("Usage: python script.py <input.osm>")
        sys.exit(1)

    input_file = sys.argv[1]
    base_name = os.path.splitext(input_file)[0]
    output_file = base_name + '.geojson'

    osm_xml_to_geojson(input_file, output_file)
    print(f"GeoJSON has been saved to {output_file}")
