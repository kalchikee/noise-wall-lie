'use strict';
const LA = [-118.2437, 34.0522];
let map, barrierData, equityData;

function effectivenessColor(eff, isGap) {
  if (isGap) return '#e84141';
  if (eff === 'high') return '#44cc44';
  if (eff === 'medium') return '#ffd700';
  return '#ff7b00';
}

map = new maplibregl.Map({
  container:'map',
  style:{version:8,sources:{base:{type:'raster',tiles:['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],tileSize:256,attribution:'© CARTO © OSM'}},layers:[{id:'base',type:'raster',source:'base'}]},
  center:LA, zoom:10
});
map.addControl(new maplibregl.NavigationControl({showCompass:false}),'bottom-right');

map.on('load', () => {
  Promise.all([
    fetch('data/noise_barriers.geojson').then(r=>r.json()),
    fetch('data/equity_stats.json').then(r=>r.json()),
  ]).then(([barriers, equity]) => {
    barrierData = barriers;
    equityData = equity;
    buildEquityBars(equity);

    map.addSource('barriers', {type:'geojson', data:barriers});

    // Barrier lines
    map.addLayer({
      id:'barrier-lines-bg', type:'line', source:'barriers',
      paint:{
        'line-color':['case',['==',['get','effectiveness'],'gap'],'#e84141',['==',['get','effectiveness'],'high'],'#44cc44',['==',['get','effectiveness'],'medium'],'#ffd700','#ff7b00'],
        'line-width':8, 'line-opacity':0.2
      }
    });
    map.addLayer({
      id:'barrier-lines', type:'line', source:'barriers',
      paint:{
        'line-color':['case',['==',['get','effectiveness'],'gap'],'#e84141',['==',['get','effectiveness'],'high'],'#44cc44',['==',['get','effectiveness'],'medium'],'#ffd700','#ff7b00'],
        'line-width':4,
        'line-dasharray':['case',['==',['get','effectiveness'],'gap'],['literal',[4,4]],['literal',[1,0]]]
      }
    });

    map.on('mouseenter','barrier-lines',()=>map.getCanvas().style.cursor='pointer');
    map.on('mouseleave','barrier-lines',()=>map.getCanvas().style.cursor='');
    map.on('click','barrier-lines', e => showBarrierDetail(e.features[0].properties));

    setupFilters();
    document.getElementById('info-close').addEventListener('click',()=>{
      document.getElementById('info-panel').style.display='none';
      document.getElementById('about-panel').style.display='';
    });
  });
});

function buildEquityBars(equity) {
  const container = document.getElementById('equity-bars');
  equity.protected_by_income_quartile.forEach(q => {
    const pct = q.pct_highway_adjacent_protected;
    const div = document.createElement('div');
    div.className = 'equity-bar-row';
    div.innerHTML = `
      <div class="equity-bar-label"><span>${q.quartile}</span><span style="color:var(--text);font-weight:600">${pct}% protected</span></div>
      <div class="equity-bar-track"><div class="equity-bar-fill" style="width:${pct}%;background:${pct>60?'#44cc44':pct>40?'#ffd700':'#e84141'}"></div></div>
    `;
    container.appendChild(div);
  });
}

function showBarrierDetail(p) {
  document.getElementById('info-panel').style.display='';
  document.getElementById('about-panel').style.display='none';
  document.getElementById('info-title').textContent = p.name;

  const isGap = p.effectiveness === 'gap';
  const eff = p.effectiveness;
  const color = effectivenessColor(eff, isGap);

  if (isGap) {
    document.getElementById('info-content').innerHTML = `
      <div class="gap-warning">⚠ UNPROTECTED GAP — No noise barrier at this location</div>
      <div style="height:10px"></div>
      <div class="info-row"><span class="info-key">Highway</span><span class="info-value">${p.highway}</span></div>
      <div class="info-row"><span class="info-key">Community</span><span class="info-value">${p.community}</span></div>
      <div class="info-row"><span class="info-key">Exposed homes</span><span class="info-value" style="color:#ff8888">${Number(p.exposed_homes).toLocaleString()}</span></div>
      <div class="info-row"><span class="info-key">Ambient noise level</span><span class="info-value">${p.noise_before_db} dB</span></div>
      <div class="info-row"><span class="info-key">Median income</span><span class="info-value">$${Number(p.median_income).toLocaleString()}</span></div>
      <div class="info-row"><span class="info-key">% minority residents</span><span class="info-value">${p.pct_minority}%</span></div>
    `;
  } else {
    const perf = p.performance_gap;
    document.getElementById('info-content').innerHTML = `
      <div class="db-compare">
        <div class="db-box" style="background:rgba(68,204,68,.1);border:1px solid rgba(68,204,68,.2)">
          <div class="val" style="color:#77dd77">${p.noise_reduction_db} dB</div>
          <div class="lbl">Actual reduction</div>
        </div>
        <div class="db-box" style="background:rgba(155,89,182,.1);border:1px solid rgba(155,89,182,.2)">
          <div class="val" style="color:#c39bd3">${p.promised_reduction_db} dB</div>
          <div class="lbl">Promised reduction</div>
        </div>
      </div>
      ${perf > 0 ? `<div style="font-size:12px;color:#ff8888;margin-bottom:10px">⚠ Underperforming by ${perf} dB vs. engineering estimate</div>` : `<div style="font-size:12px;color:#77dd77;margin-bottom:10px">✓ Performing as designed</div>`}
      <div class="info-row"><span class="info-key">Highway</span><span class="info-value">${p.highway}</span></div>
      <div class="info-row"><span class="info-key">Community</span><span class="info-value">${p.community}</span></div>
      <div class="info-row"><span class="info-key">Length</span><span class="info-value">${Number(p.length_ft).toLocaleString()} ft</span></div>
      <div class="info-row"><span class="info-key">Height</span><span class="info-value">${p.height_ft} ft</span></div>
      <div class="info-row"><span class="info-key">Year built</span><span class="info-value">${p.year_built}</span></div>
      <div class="info-row"><span class="info-key">Noise before</span><span class="info-value">${p.noise_before_db} dB</span></div>
      <div class="info-row"><span class="info-key">Noise after</span><span class="info-value">${p.noise_after_db} dB</span></div>
      <div class="info-row"><span class="info-key">Median income</span><span class="info-value">$${Number(p.median_income).toLocaleString()}</span></div>
      <div class="info-row"><span class="info-key">% white residents</span><span class="info-value">${p.pct_white}%</span></div>
      <div class="info-row"><span class="info-key">Property value premium</span><span class="info-value">+${p.property_value_premium_pct}%</span></div>
    `;
  }
}

function setupFilters() {
  document.getElementById('filter-highway').addEventListener('change', applyFilters);
  document.getElementById('filter-show').addEventListener('change', applyFilters);
  document.getElementById('toggle-demographics').addEventListener('change', e => {
    // Toggle would load a demographic layer — visual indicator for now
    const sb = document.getElementById('about-panel');
    if (e.target.checked) {
      sb.innerHTML += '<div style="padding:10px;background:rgba(155,89,182,.1);border:1px solid rgba(155,89,182,.2);border-radius:6px;margin-top:10px;font-size:12px;color:var(--muted)">Demographic overlay: Line width proportional to % minority population. Thicker lines = more minority residents exposed.</div>';
      map.setPaintProperty('barrier-lines','line-width',['interpolate',['linear'],['get','pct_minority'],0,2,100,8]);
    } else {
      map.setPaintProperty('barrier-lines','line-width',4);
    }
  });
}

function applyFilters() {
  const hwy = document.getElementById('filter-highway').value;
  const show = document.getElementById('filter-show').value;
  const filter = ['all'];
  if (hwy !== 'all') filter.push(['==',['get','highway'],hwy]);
  if (show === 'barriers') filter.push(['!=',['get','effectiveness'],'gap']);
  if (show === 'gaps') filter.push(['==',['get','effectiveness'],'gap']);
  if (show === 'underperforming') filter.push(['all',['!=',['get','effectiveness'],'gap'],['==',['get','effectiveness'],'low']]);
  const f = filter.length > 1 ? filter : null;
  ['barrier-lines','barrier-lines-bg'].forEach(l => map.setFilter(l, f));
}
