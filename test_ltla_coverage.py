import json

data = json.load(open('public/ltla_flows.geojson'))

# Testar alguns distritos específicos
test_districts = [
    'E09000033',  # Westminster
    'E08000003',  # Manchester
    'E08000035',  # Leeds
    'E06000001',  # Hartlepool
]

print("Flows por distrito no arquivo LTLA atual:\n")

for code in test_districts:
    incoming = [f for f in data['features'] if f['properties']['dest_code'] == code]
    outgoing = [f for f in data['features'] if f['properties']['origin_code'] == code]
    
    name = incoming[0]['properties']['dest_name'] if incoming else (outgoing[0]['properties']['origin_name'] if outgoing else 'Unknown')
    
    print(f"{name} ({code}):")
    print(f"  Incoming: {len(incoming)} flows")
    print(f"  Outgoing: {len(outgoing)} flows")
    print()
