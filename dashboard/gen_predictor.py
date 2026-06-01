import json, math
from collections import defaultdict

# Will It Resolve? — pre-compute logistic regression weights
# Features: n_answers (bucket), era, urban/rural, cluster

with open('public/data/all_qa.json') as f:
    all_qa = json.load(f)
with open('public/data/umap_coords.json') as f:
    umap = json.load(f)
with open('public/data/geographic_data.json') as f:
    geo = json.load(f)

labels = umap['labels']

# Build caller location lookup
loc_counts = {}
for ep in all_qa['episodes']:
    for q in (ep.get('questions') or []):
        caller = q.get('caller', '')
        if ' from ' in caller:
            loc = caller.split(' from ').pop().strip()
            town = (loc.split(',').pop().strip())
            if town:
                loc_counts[q.get('caller', '')] = town

# Urban towns from geographic_data
geo_urban = {loc['location'] for loc in geo.get('top_locations', []) if loc.get('region') in ('Greater London', 'Greater Manchester', 'West Midlands')}

n_eps = len(all_qa['episodes'])
era_size = n_eps // 6

# Features: era (0-5), urban (0/1), n_answers (0-4+), cluster_group (0-3)
# cluster_groups: 0=low_turn, 1=mid, 2=high, 3=very_high_overturn
overturn_rates = defaultdict(lambda: {'total': 0, 'over': 0})

q_idx = 0
samples = []
for ep in all_qa['episodes']:
    ei = int(ep['episode'].split('_')[1])
    era = min(ei // era_size, 5)
    for q in (ep.get('questions') or []):
        caller = q.get('caller', '')
        loc = loc_counts.get(caller, '')
        urban = 1 if loc in geo_urban else 0
        na = min(len(q.get('answers') or []), 4)  # 0-4+
        resolved = 1 if q.get('resolved') else 0
        samples.append({'era': era, 'urban': urban, 'n_answers': na, 'resolved': resolved})
        q_idx += 1

# Simple weight estimation using conditional probabilities
# P(resolved | era, urban, n_answers) ~ observed rate
# We compute mean resolved rate per bucket

era_stats = defaultdict(lambda: {'n': 0, 'res': 0})
urban_stats = defaultdict(lambda: {'n': 0, 'res': 0})
na_stats = defaultdict(lambda: {'n': 0, 'res': 0})
overall_res = 0

for s in samples:
    overall_res += s['resolved']
    era_stats[s['era']]['n'] += 1
    era_stats[s['era']]['res'] += s['resolved']
    urban_stats[s['urban']]['n'] += 1
    urban_stats[s['urban']]['res'] += s['resolved']
    na_stats[s['n_answers']]['n'] += 1
    na_stats[s['n_answers']]['res'] += s['resolved']

overall_res /= len(samples)
base_res = overall_res

era_weights = {}
for e in range(6):
    d = era_stats[e]
    era_weights[e] = (d['res'] / max(d['n'], 1)) - overall_res

urban_weight = (urban_stats[1]['res'] / max(urban_stats[1]['n'], 1)) - overall_res
rural_weight = (urban_stats[0]['res'] / max(urban_stats[0]['n'], 1)) - overall_res

na_weights = {}
for na in range(5):
    d = na_stats[na]
    na_weights[na] = (d['res'] / max(d['n'], 1)) - overall_res

# Urban towns set
geo_urban = {loc['location'] for loc in geo.get('top_locations', []) if loc.get('region') in ('Greater London', 'Greater Manchester', 'West Midlands')}

# Per-era resolved rates
era_rates = {}
for e in range(6):
    d = era_stats[e]
    era_rates[e] = {'rate': round(d['res'] / max(d['n'], 1), 4), 'n': d['n']}

# Per n_answers resolved rates
na_rates = {}
for na in range(5):
    d = na_stats[na]
    na_rates[na] = {'rate': round(d['res'] / max(d['n'], 1), 4), 'n': d['n']}

urban_rate = urban_stats[1]['res'] / max(urban_stats[1]['n'], 1)
rural_rate = urban_stats[0]['res'] / max(urban_stats[0]['n'], 1)

result = {
    'overall_resolved_rate': round(overall_res, 4),
    'era_weights': {str(k): round(v, 4) for k, v in era_weights.items()},
    'urban_weight': round(urban_weight, 4),
    'rural_weight': round(rural_weight, 4),
    'na_weights': {str(k): round(v, 4) for k, v in na_weights.items()},
    'era_rates': {str(k): v for k, v in era_rates.items()},
    'na_rates': {str(k): v for k, v in na_rates.items()},
    'urban_rate': round(urban_rate, 4),
    'rural_rate': round(rural_rate, 4),
    'n_samples': len(samples),
}

with open('public/data/will_resolve_predictor.json', 'w') as f:
    json.dump(result, f, indent=2)

print(f"Saved predictor: {len(samples)} samples, overall={overall_res:.3f}")
print("Era rates:", {k: round(v['rate'], 3) for k, v in era_rates.items()})
print("NA rates:", {k: round(v['rate'], 3) for k, v in na_rates.items()})
print("Urban:", round(urban_rate, 3), "Rural:", round(rural_rate, 3))
