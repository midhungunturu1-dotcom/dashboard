# Customer Segmentation Dashboard

This repository contains a pure frontend customer segmentation dashboard built with HTML, CSS, and JavaScript.

## Features

- Upload a customer CSV file directly in the browser
- Parse CSV with PapaParse
- Run K-Means clustering entirely in JavaScript
- KPI cards for total customers, average income, average spending score, and segment count
- Chart.js scatter plot and pie chart visualizations
- Deployable to GitHub Pages as a static site

## Usage

1. Open `index.html` in a browser.
2. Upload a CSV file with these columns:
   - `Age`
   - `Income`
   - `Spending Score`
3. Click `Segment` to view cluster results.

## Notes

- No backend is required.
- The clustering runs entirely in the browser.
- If you host this on GitHub Pages, make sure the repository is public or served as a static site.
