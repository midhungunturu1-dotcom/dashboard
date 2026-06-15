from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from sklearn.cluster import KMeans

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

REQUIRED_COLUMNS = ['Age', 'Income', 'Spending Score']

@app.route('/api/segment', methods=['POST'])
def segment_customers():
    if 'file' not in request.files:
        return 'Missing CSV file.', 400

    file = request.files['file']
    try:
        df = pd.read_csv(file)
    except Exception:
        return 'Invalid CSV format.', 400

    missing_columns = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing_columns:
        return f'Missing columns: {", ".join(missing_columns)}', 400

    try:
        segments = int(request.form.get('segments', 4))
        if segments < 2:
            segments = 4
    except ValueError:
        segments = 4

    features = df[REQUIRED_COLUMNS].dropna()
    if features.empty:
        return 'CSV does not contain usable customer data.', 400

    kmeans = KMeans(n_clusters=segments, random_state=42, n_init=10)
    labels = kmeans.fit_predict(features)
    df = df.loc[features.index].copy()
    df['segment'] = labels

    kpis = {
        'total_customers': int(len(df)),
        'average_income': float(df['Income'].mean()),
        'average_spending_score': float(df['Spending Score'].mean()),
        'number_of_segments': int(segments),
    }

    distribution = (
        df.groupby('segment')
        .size()
        .reset_index(name='count')
        .sort_values('segment')
        .rename(columns={'segment': 'segment'})
    )
    distribution['segment'] = distribution['segment'] + 1
    distribution_data = distribution.to_dict(orient='records')

    summary = (
        df.groupby('segment')
        .agg(average_income=('Income', 'mean'), average_spending_score=('Spending Score', 'mean'))
        .reset_index()
        .sort_values('segment')
    )
    summary['segment'] = summary['segment'] + 1
    segment_summary = [
        {
            'segment': int(row['segment']),
            'average_income': float(row['average_income']),
            'average_spending_score': float(row['average_spending_score']),
        }
        for _, row in summary.iterrows()
    ]

    points = features[['Income', 'Spending Score']].values.tolist()
    segment_centers = kmeans.cluster_centers_.tolist()

    return jsonify({
        'kpis': kpis,
        'distribution': distribution_data,
        'segment_summary': segment_summary,
        'points': points,
        'segment_labels': labels.tolist(),
        'segment_centers': segment_centers,
    })

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
