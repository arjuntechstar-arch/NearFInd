const categories = ['Fuel', 'EV Charge', 'ATM', 'Hospital', 'Mechanic', 'Bank'];

const services = [
  {
    name: 'Shell Fuel Station',
    category: 'Fuel',
    distance: '1.2 km',
    status: 'Open 24 hours',
    meta: 'Petrol • Diesel • Air',
    badge: 'Live price',
  },
  {
    name: 'ChargeGrid Fast EV',
    category: 'EV Charge',
    distance: '2.4 km',
    status: '4 connectors available',
    meta: 'CCS2 • 60 kW',
    badge: 'Available',
  },
  {
    name: 'CityCare Hospital',
    category: 'Hospital',
    distance: '3.1 km',
    status: 'Emergency open',
    meta: 'Emergency • Pharmacy',
    badge: '24/7',
  },
];

export default function HomePage() {
  return (
    <main className="appShell">
      <aside className="rail" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="NearFind home">
          <span className="brandMark" aria-hidden="true">N</span>
          <span>NearFind</span>
        </a>
        <nav className="railNav">
          <a className="navItem active" href="#explore">Explore</a>
          <a className="navItem" href="#browse">Browse</a>
          <a className="navItem" href="#saved">Saved & SOS</a>
          <a className="navItem" href="#community">Community</a>
          <a className="navItem" href="#profile">Profile</a>
        </nav>
        <div className="railFooter">
          <p className="eyebrow">Safety first</p>
          <p className="smallText">Emergency features never delay direct access to local emergency numbers.</p>
        </div>
      </aside>

      <section className="content" id="explore">
        <header className="topbar" id="top">
          <div>
            <p className="eyebrow">Driver companion</p>
            <h1>Find what you need nearby.</h1>
          </div>
          <button className="ghostButton" type="button">Notifications</button>
        </header>

        <div className="searchRow" role="search">
          <label className="searchBox">
            <span className="srOnly">Search nearby services</span>
            <input type="search" placeholder="Search fuel, ATM, hospital, mechanic…" />
          </label>
          <button className="primaryButton" type="button">Use my location</button>
        </div>

        <div className="chipRow" aria-label="Service categories">
          {categories.map((category, index) => (
            <button className={index === 0 ? 'chip chipActive' : 'chip'} key={category} type="button">
              {category}
            </button>
          ))}
        </div>

        <div className="exploreGrid">
          <section className="resultsPane" aria-labelledby="nearby-title">
            <div className="sectionHeading">
              <div>
                <p className="eyebrow">Near your current area</p>
                <h2 id="nearby-title">Nearby services</h2>
              </div>
              <button className="textButton" type="button">Filters</button>
            </div>

            <div className="resultList">
              {services.map((service) => (
                <article className="serviceCard" key={service.name}>
                  <div className="serviceIcon" aria-hidden="true">{service.category.slice(0, 1)}</div>
                  <div className="serviceBody">
                    <div className="cardTitleRow">
                      <div>
                        <p className="categoryLabel">{service.category}</p>
                        <h3>{service.name}</h3>
                      </div>
                      <span className="statusBadge">{service.badge}</span>
                    </div>
                    <p className="serviceMeta">{service.distance} • {service.status}</p>
                    <p className="smallText">{service.meta}</p>
                    <div className="cardActions">
                      <button className="secondaryButton" type="button">Details</button>
                      <button className="primaryButton compact" type="button">Route</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mapPane" aria-labelledby="map-title">
            <div className="mapToolbar">
              <div>
                <p className="eyebrow">Live area view</p>
                <h2 id="map-title">Map</h2>
              </div>
              <span className="privacyBadge">Location private by default</span>
            </div>
            <div className="mapCanvas" role="img" aria-label="Stylized preview of the future interactive service map">
              <div className="road roadA" />
              <div className="road roadB" />
              <div className="road roadC" />
              <span className="mapPin pinA">F</span>
              <span className="mapPin pinB">E</span>
              <span className="mapPin pinC">H</span>
              <div className="mapHint">
                <strong>Map provider integration is next.</strong>
                <span>The production map will query the API by viewport and radius rather than downloading every service point.</span>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
