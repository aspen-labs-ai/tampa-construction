# Tampa Under Construction

An interactive map app showing every active construction and infrastructure project in Tampa, FL.

## Tech Stack
- **Framework:** Next.js 15 (App Router, TypeScript)
- **Map:** MapLibre GL JS with OpenFreeMap tiles (100% free, no API key)
- **Styling:** Tailwind CSS v4
- **Data Fetching:** SWR for client-side caching
- **Deployment:** Vercel

## Data Sources (all free, public, no auth required)

### 1. Construction Inspections (ArcGIS REST)
- **URL:** `https://arcgis.tampagov.net/arcgis/rest/services/OpenData/Planning/MapServer/30`
- **Records:** ~2,523 active
- **Key Fields:** RECORD_ID, PROJECTNAME1, PROJECTNAME2, PROJECTDESCRIPTION, ADDRESS, ZIP, PROJECTSTATUS (Issued/Revision), NEWCONSTRUCTIONSF, OCCUPANCYCATEGORY, OCCUPANCYTYPE (Dwellings, Business, Assembly, etc.), NBROFUNITS, RECORDTYPE, PRIVATEPROVIDER, STOPWORKORDER, NEIGHBORHOOD, COUNCIL, CRA, URL (link to Accela detail page)
- **Record Types:** Residential New Construction (1,295), Commercial Alterations (418), Residential Alterations (408), Commercial New Construction (254), Residential Demolition (116), Commercial Demolition (13)
- **Geometry:** Points (lat/lng)

### 2. Right-of-Way Permits (ArcGIS REST)
- **URL:** `https://arcgis.tampagov.net/arcgis/rest/services/Transportation/ROWPermits/FeatureServer/0`
- **Records:** ~97,686 total, ~25,182 currently active (PERMITACTIVESTAT=Yes)
- **Key Fields:** RECORDID, APPNAME, APPTYPE, DESCRIPTION, PROJMANAGER, STARTDATE, ENDDATE, ACTIVETASK, LOCATION, TASKSTATUS, ISSUED, OVERDUE, NEIGHBORHOOD, COUNCILDISTRICT, CRA, APPLICATIONSTATUS, PERMITACTIVESTAT, ALLLOCATION
- **Permit Types:** Standard ROW (57K), City Dept Work (20K), Utility Work (19K), Telecom (1.5K)
- **Geometry:** Points (lat/lng)
- **Note:** Filter to PERMITACTIVESTAT=Yes for current work

### 3. Capital Improvement Projects (ArcGIS REST)
- **URL:** `https://arcgis.tampagov.net/arcgis/rest/services/CapitalProjects/CapitalProjects/FeatureServer/0`
- **Records:** 186
- **Key Fields:** projid, projname, projdesc, rationale, projtype (Transportation, Wastewater, Water, Stormwater, Parks), fiscalyr, fundsource, planstart, planend, estcost, actcost, projphase, status (Construction in Progress, 90% Design, 30% Design, Planning, Closeout, etc.), pocname, pocphone, pocemail, Neighborhood, Council, ContractNumber, EBO, EBOAttained, JobsCreated
- **Geometry:** Points
- **Note:** Coordinate system is State Plane (need to convert to lat/lng using outSR=4326)

### 4. Single Family Permits (ArcGIS REST)
- **URL:** `https://arcgis.tampagov.net/arcgis/rest/services/OpenData/Planning/MapServer/32`
- **Records:** ~996
- **Key Fields:** RECORD_ID, APPLICATION_TYPE, APPLICATION_STATUS, OPENED_DATE, TASK, TASK_STATUS, ADDRESS, ZIP, NEIGHBORHOOD, COUNCIL, CRA, YEAR
- **Geometry:** Points (lat/lng)

### 5. Aggregate Trends (CKAN API)
- **URL:** `https://opendata.tampa.gov/api/3/action/datastore_search?resource_id=5471f639-e588-410b-984b-c5c09d8a2349`
- **Records:** 3,411 monthly summary data points
- **Key Charts:** Permits by month (residential/commercial/multi-family), job value by month, new construction by zip code, review times, COs issued
- **Use for:** Dashboard trend charts and KPIs

## ArcGIS Query Pattern
```
GET {service_url}/query?where=1%3D1&outFields=*&outSR=4326&f=json&resultRecordCount=2000
```
- Use `outSR=4326` to get WGS84 lat/lng
- Paginate with `resultOffset` for large datasets
- Filter active ROW: `where=PERMITACTIVESTAT%3D'Yes'`
- Max 2000 records per request, paginate with resultOffset

## UI Design

### Map View (Main)
- Full-screen interactive map centered on Tampa (27.9506, -82.4572)
- Color-coded markers by layer:
  - 🔵 Blue: Residential new construction
  - 🟠 Orange: Commercial construction
  - 🟢 Green: Renovations/alterations
  - 🔴 Red: Demolitions
  - 🟡 Yellow: ROW/street work (clustered, there are 25K)
  - 🟣 Purple: Capital projects (larger markers, these are big)
- Marker clustering for dense areas (especially ROW permits)
- Click marker → popup with project details + link to Accela
- Layer toggle panel (show/hide each data source)

### Sidebar / Filter Panel
- Filter by:
  - Layer type (construction, ROW, capital, single family)
  - Record type (new construction, renovation, demolition)
  - Neighborhood (dropdown with all Tampa neighborhoods)
  - Council district (1-7)
  - Status (active, issued, in progress, etc.)
  - Date range
- Search by address
- Active filter chips showing current filters

### Dashboard Panel (collapsible)
- Total active projects count by type
- Top 10 neighborhoods by construction activity
- Monthly permit trends (line chart from CKAN data)
- Construction value by area (from CKAN job value data)

### Detail Panel (on marker click)
- Full project details
- Link to official Accela permit page
- Neighborhood context
- For capital projects: cost, timeline, phase, contact info

## Design
- Dark theme (construction/infrastructure vibe)
- Responsive (works on mobile)
- Fast initial load (fetch only visible map bounds initially, lazy load rest)

## Performance Considerations
- Cluster ROW permits aggressively (25K points)
- Lazy load data by map viewport (use ArcGIS spatial query with geometry envelope)
- Cache responses with SWR (1 hour stale time, city data updates daily)
- Use MapLibre's built-in GeoJSON clustering

## Pages
- `/` — Main map view with all layers
- No other pages needed for MVP, this is a single-page map app
