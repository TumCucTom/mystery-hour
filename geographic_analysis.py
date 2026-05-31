#!/usr/bin/env python3
"""
geographic_analysis.py — Extract caller locations from metadata.
Parse "Caller from TOWN" pattern, count by location,
identify urban vs rural, and build geographic heatmap data.
"""

import json
from pathlib import Path
from collections import Counter, defaultdict

SCRATCH   = Path("/scratch/b6ar/trvbale.b6ar")
META_JSON = SCRATCH / "embeddings" / "question_meta.json"
OUT       = SCRATCH / "embeddings" / "geographic_data.json"

# UK place name patterns — towns/cities to validate against
KNOWN_COUNTIES = {
    'london': 'Greater London', 'manchester': 'Greater Manchester',
    'birmingham': 'West Midlands', 'leeds': 'West Yorkshire',
    'glasgow': 'Scotland', 'liverpool': 'Merseyside', 'newcastle': 'Tyne and Wear',
    'sheffield': 'South Yorkshire', 'bristol': 'Bristol', 'leicester': 'Leicestershire',
    'edinburgh': 'Scotland', 'cardiff': 'Wales', 'belfast': 'Northern Ireland',
    'nottingham': 'Nottinghamshire', 'southampton': 'Hampshire', 'norwich': 'Norfolk',
    'portsmouth': 'Hampshire', ' cambridge': 'Cambridgeshire', 'oxford': 'Oxfordshire',
    'bath': 'Somerset', 'york': 'North Yorkshire', 'exeter': 'Devon',
    'plymouth': 'Devon', ' cheltenham': 'Gloucestershire', 'bournemouth': 'Dorset',
    'worcester': 'Worcestershire', 'coventry': 'West Midlands',
    'stoke': 'Staffordshire', 'sunderland': 'Tyne and Wear',
    'milton keynes': 'Buckinghamshire', 'wolverhampton': 'West Midlands',
    'derby': 'Derbyshire', 'swindon': 'Wiltshire', 'rotherham': 'South Yorkshire',
    'oldham': 'Greater Manchester', 'wigan': 'Greater Manchester',
    'stockport': 'Greater Manchester', ' Bolton': 'Greater Manchester',
    'rochdale': 'Greater Manchester', 'huddersfield': 'West Yorkshire',
    'bradford': 'West Yorkshire', 'hull': 'East Yorkshire',
    'southend': 'Essex', 'colchester': 'Essex', 'chelmsford': 'Essex',
    'maidstone': 'Kent', 'canterbury': 'Kent', 'dover': 'Kent',
    'reading': 'Berkshire', ' Guildford': 'Surrey', 'woking': 'Surrey',
    'croydon': 'Greater London', 'bromley': 'Greater London',
    'harrow': 'Greater London', 'hillingdon': 'Greater London',
    'enfield': 'Greater London', 'sutton': 'Greater London',
    'middlesbrough': 'North Yorkshire', 'darlington': 'County Durham',
    'weston-super-mare': 'Somerset', 'torquay': 'Devon',
    'ipswich': 'Suffolk', 'peterborough': 'Cambridgeshire',
}

def parse_caller(caller_str):
    """Extract location from caller string like 'Neil from Farnham' or 'Caller in Birmingham'."""
    if not caller_str:
        return None, None
    caller = caller_str.lower().strip()

    # Pattern: "X from Y" or "Caller in Y" or "Y resident"
    for prep in [' from ', ' in ', ' resident ', ' caller in ']:
        if prep in caller:
            parts = caller.split(prep)
            loc = parts[-1].strip().strip('.,!?')
            # Clean trailing descriptors
            loc = loc.split(',')[0].split(' (')[0].strip()
            if len(loc) > 1 and len(loc) < 40:
                region = KNOWN_COUNTIES.get(loc, 'UK')
                return loc, region

    return None, None

def main():
    with open(META_JSON) as f:
        meta = json.load(f)

    locations = []
    for m in meta:
        caller = m.get('caller', '')
        loc, region = parse_caller(caller)
        if loc:
            locations.append({
                'location': loc,
                'region': region,
                'episode': m.get('episode', '?'),
                'question': (m.get('question') or '')[:80],
                'resolved': m.get('resolved', False),
            })

    # Count by location
    loc_counts = Counter(l['location'] for l in locations)
    region_counts = Counter(l['region'] for l in locations)

    # Build top locations with resolution rates
    top_locations = []
    for loc, count in loc_counts.most_common(60):
        loc_questions = [l for l in locations if l['location'] == loc]
        resolved_count = sum(1 for lq in loc_questions if lq['resolved'])
        top_locations.append({
            'location': loc.title(),
            'count': count,
            'resolved_rate': round(resolved_count / count, 3) if count else 0,
            'region': loc_questions[0]['region'],
        })

    # Urban vs rural (large cities vs small towns)
    urban_keywords = ['london', 'manchester', 'birmingham', 'glasgow', 'liverpool',
                      'leeds', 'sheffield', 'bristol', 'newcastle', 'edinburgh',
                      'cardiff', 'belfast', 'nottingham', 'southampton', 'leicester',
                      'coventry', 'bradford', 'hull', 'sunderland', 'derby']
    urban_count = sum(c for loc, c in loc_counts.items() if any(u in loc for u in urban_keywords))
    rural_count  = sum(c for loc, c in loc_counts.items() if loc not in urban_keywords)

    print(f"Geographic Analysis:")
    print(f"  Total callers with location: {len(locations)}")
    print(f"  Unique locations: {len(loc_counts)}")
    print(f"  Urban calls: {urban_count}  Rural calls: {rural_count}")
    print(f"  Top locations: {', '.join(l for l, c in loc_counts.most_common(10))}")

    out = {
        'summary': {
            'total_geolocated': len(locations),
            'unique_locations': len(loc_counts),
            'urban_calls': urban_count,
            'rural_calls': rural_count,
            'urban_resolved_rate': round(sum(1 for l in locations if any(u in l['location'] for u in urban_keywords) and l['resolved']) / urban_count, 3) if urban_count else 0,
            'rural_resolved_rate': round(sum(1 for l in locations if not any(u in l['location'] for u in urban_keywords) and l['resolved']) / rural_count, 3) if rural_count else 0,
        },
        'top_locations': top_locations,
        'region_counts': dict(region_counts.most_common(15)),
    }

    with open(OUT, 'w') as f:
        json.dump(out, f, indent=2)
    print(f"Saved → {OUT}")

if __name__ == '__main__':
    main()