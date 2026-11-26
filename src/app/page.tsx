"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  Coffee,
  Footprints,
  LocateFixed,
  MapPin,
  Minus,
  Navigation,
  Plus,
  Route,
  Search,
  ShieldCheck,
  Store,
  TreePine,
  X,
} from "lucide-react";

type RouteOption = {
  id: string;
  name: string;
  duration: string;
  distance: string;
  note: string;
  tag?: string;
};

const routeOptions: RouteOption[] = [
  {
    id: "quiet",
    name: "Quieter streets",
    duration: "18 min",
    distance: "1.2 km",
    note: "Fewer major roads",
    tag: "RECOMMENDED",
  },
  {
    id: "balanced",
    name: "Balanced",
    duration: "14 min",
    distance: "1.1 km",
    note: "A calm, direct walk",
  },
  {
    id: "fast",
    name: "Fastest",
    duration: "12 min",
    distance: "1.0 km",
    note: "Most direct route",
  },
];

const destinationTypes = [
  { label: "Parks", value: "Riverside Park", Icon: TreePine },
  { label: "Shops", value: "Market Street", Icon: Store },
  { label: "Coffee", value: "Juniper Coffee", Icon: Coffee },
  { label: "Work", value: "Work", Icon: BriefcaseBusiness },
];

export default function Home() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("Riverside Park");
  const [selectedRoute, setSelectedRoute] = useState("quiet");
  const [notice, setNotice] = useState("");
  const [mapZoom, setMapZoom] = useState(1);

  const activeRoute =
    routeOptions.find((option) => option.id === selectedRoute) ?? routeOptions[0];

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(
      destination.trim()
        ? "Place search is not connected yet. These sample routes are here to preview the experience."
        : "Enter a destination to preview a route.",
    );
  }

  function handleUseLocation() {
    setNotice("Location permission will be added when the map is connected.");
  }

  return (
    <main className="waymark-app">
      <header className="app-header">
        <a className="wordmark" href="/" aria-label="Waymark home">
          <span className="wordmark-icon"><Route size={19} strokeWidth={2.2} /></span>
          <span>waymark</span>
          <span className="wordmark-beta">BETA</span>
        </a>

        <div className="header-location">
          <span className="header-location-dot" />
          <span>NEIGHBORHOOD PREVIEW</span>
          <span className="header-location-divider" />
          <MapPin size={13} />
          <span>Portland, OR</span>
        </div>

        <button className="header-avatar" type="button" aria-label="Profile menu">
          W
        </button>
      </header>

      <div className="planner-layout">
        <aside className="planner-sidebar">
          <div className="sidebar-intro">
            <p className="overline"><Footprints size={13} /> A BETTER WAY THERE</p>
            <h1>Take the <em>scenic</em> route.</h1>
            <p className="intro-copy">
              Find a calmer walk to anywhere in your city. Parks, coffee, work, or wherever.
            </p>
          </div>

          <form className="destination-form" onSubmit={handleSearch}>
            <div className="location-fields">
              <div className="location-field">
                <span className="field-marker start-marker"><span /></span>
                <label className="field-content">
                  <span className="field-label">FROM</span>
                  <input
                    value={origin}
                    onChange={(event) => setOrigin(event.target.value)}
                    placeholder="Your location or an address"
                    aria-label="Starting point"
                  />
                </label>
                <button
                  type="button"
                  className="locate-button"
                  onClick={handleUseLocation}
                  aria-label="Use my current location"
                  title="Use my current location"
                >
                  <LocateFixed size={16} />
                </button>
              </div>
              <div className="field-connector" />
              <div className="location-field">
                <span className="field-marker destination-marker"><MapPin size={15} /></span>
                <label className="field-content">
                  <span className="field-label">TO</span>
                  <input
                    value={destination}
                    onChange={(event) => setDestination(event.target.value)}
                    placeholder="A park, shop, office..."
                    aria-label="Destination"
                  />
                </label>
                {destination && (
                  <button
                    type="button"
                    className="clear-destination"
                    onClick={() => setDestination("")}
                    aria-label="Clear destination"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            <div className="quick-destinations">
              <span className="quick-label">GOING TO</span>
              <div className="destination-chips">
                {destinationTypes.map(({ label, value, Icon }) => (
                  <button
                    className={`destination-chip${destination === value ? " selected" : ""}`}
                    key={label}
                    type="button"
                    onClick={() => {
                      setDestination(value);
                      setNotice("");
                    }}
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="find-route-button">
              <Search size={16} />
              Preview a walk
              <ArrowRight size={16} className="find-route-arrow" />
            </button>
            {notice && <p className="prototype-notice" role="status">{notice}</p>}
          </form>

          <section className="route-results" aria-labelledby="route-results-title">
            <div className="route-results-heading">
              <div>
                <p className="overline results-overline">SAMPLE ROUTES</p>
                <h2 id="route-results-title">Choose your way</h2>
              </div>
              <span className="route-count">3 options</span>
            </div>

            <div className="route-options" role="radiogroup" aria-label="Route preference">
              {routeOptions.map((option) => {
                const isSelected = selectedRoute === option.id;
                return (
                  <button
                    className={`route-option${isSelected ? " active" : ""}`}
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelectedRoute(option.id)}
                  >
                    <span className={`route-option-icon route-icon-${option.id}`}>
                      {option.id === "quiet" ? <TreePine size={17} /> : option.id === "balanced" ? <ArrowDownUp size={16} /> : <Navigation size={16} />}
                    </span>
                    <span className="route-option-main">
                      <span className="route-option-title">
                        <strong>{option.name}</strong>
                        {option.tag && <span className="recommended-tag">{option.tag}</span>}
                      </span>
                      <span className="route-option-note">{option.note}</span>
                    </span>
                    <span className="route-option-meta">
                      <strong>{option.duration}</strong>
                      <span>{option.distance}</span>
                    </span>
                    <span className="route-selected-check">{isSelected && <Check size={12} />}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="quietness-note">
            <span className="quietness-icon"><ShieldCheck size={15} /></span>
            <p><strong>Quietness is an estimate</strong><br />We’ll use street type and walkability, not live crowd tracking.</p>
          </div>

          <div className="sidebar-footer">
            <span>BUILT FOR THE WAY YOU WALK</span>
            <span className="footer-dot" />
            <span>DEMO MODE</span>
          </div>
        </aside>

        <section className="map-panel" aria-label="Route map preview">
          <div className="map-grid" />
          <svg
            className="city-map"
            viewBox="0 0 1200 900"
            role="img"
            aria-label={`Illustrated sample map showing the ${activeRoute.name.toLowerCase()} route to Riverside Park`}
            style={{ transform: `scale(${mapZoom})` }}
          >
            <rect width="1200" height="900" fill="#e9ebdf" />

            <path d="M715 -30 C690 150 785 260 758 420 C732 578 835 710 796 940 L1200 940 L1200 -30Z" fill="#d8e9df" />
            <path d="M850 65 C965 45 1095 95 1180 155 L1175 340 C1050 325 973 270 888 292 C822 308 770 260 783 190 C790 132 814 91 850 65Z" fill="#c7dfc9" />
            <path d="M800 575 C914 538 1048 568 1192 520 L1200 900 L817 900 C850 812 823 700 800 575Z" fill="#d1e4d0" />
            <path d="M935 104 C1013 90 1082 119 1130 165 M850 610 C961 582 1073 606 1157 571" fill="none" stroke="#b6d2bb" strokeWidth="3" strokeLinecap="round" />

            <g fill="#e0e0d7" stroke="#d3d5ca" strokeWidth="2">
              <path d="M37 67h112l-8 78H35zM183 54h133l-5 89H178zM354 61h119l-9 77H350zM506 37h133l-4 94H504z" />
              <path d="M34 185h108l-3 93H31zM177 178h136l-6 101H175zM345 177h127l-5 97H340zM497 168h129l-2 103H495z" />
              <path d="M44 318h109l-4 91H41zM189 309h124l-5 103H186zM344 315h129l-1 88H342zM500 307h130l-4 101H497z" />
              <path d="M56 462h100l-6 106H52zM184 454h130l-3 113H180zM346 449h121l-3 112H343zM496 455h137l-2 106H493z" />
              <path d="M65 612h93l-3 100H61zM187 607h125l-3 101H184zM348 604h120l-4 108H344zM498 600h125l-4 109H495z" />
              <path d="M42 763h121l-3 88H40zM195 758h115l-2 94H192zM347 759h128l-2 92H344zM507 755h114l-5 98H503z" />
              <path d="M899 374h115l-5 84H895zM1042 367h116l-3 92h-117zM888 484h130l-4 73H885zM1044 481h124l-5 76h-121z" />
            </g>

            <g fill="none" stroke="#fffdf8" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round">
              <path d="M-20 157 C210 172 360 148 575 174 C650 183 710 207 802 217 C955 234 1045 192 1220 213" />
              <path d="M-25 294 C175 284 340 297 504 290 C618 285 684 301 779 315 C933 338 1032 312 1225 326" />
              <path d="M-20 432 C188 426 344 443 513 426 C641 414 706 433 804 446 C949 464 1079 444 1220 466" />
              <path d="M-25 581 C184 568 343 585 523 574 C650 567 715 581 813 591 C963 606 1079 587 1225 607" />
              <path d="M-25 730 C172 720 351 746 530 726 C649 713 711 732 814 743 C965 759 1088 735 1225 758" />
              <path d="M162 -20 C169 157 164 284 176 431 C187 562 170 708 188 925" />
              <path d="M326 -20 C319 156 339 285 327 436 C317 559 337 716 322 920" />
              <path d="M481 -20 C491 148 472 295 486 435 C498 575 478 711 492 920" />
              <path d="M648 -30 C638 145 662 294 645 440 C630 571 657 713 644 925" />
              <path d="M820 -30 C817 120 840 251 819 369" />
              <path d="M824 491 C842 617 820 759 836 930" />
              <path d="M1009 337 C1004 421 1021 498 1008 571" />
            </g>

            <g fill="none" stroke="#d4d5ca" strokeWidth="2" strokeLinecap="round">
              <path d="M-20 157 C210 172 360 148 575 174 C650 183 710 207 802 217 C955 234 1045 192 1220 213" />
              <path d="M-25 294 C175 284 340 297 504 290 C618 285 684 301 779 315 C933 338 1032 312 1225 326" />
              <path d="M-20 432 C188 426 344 443 513 426 C641 414 706 433 804 446 C949 464 1079 444 1220 466" />
              <path d="M-25 581 C184 568 343 585 523 574 C650 567 715 581 813 591 C963 606 1079 587 1225 607" />
              <path d="M-25 730 C172 720 351 746 530 726 C649 713 711 732 814 743 C965 759 1088 735 1225 758" />
              <path d="M162 -20 C169 157 164 284 176 431 C187 562 170 708 188 925" />
              <path d="M326 -20 C319 156 339 285 327 436 C317 559 337 716 322 920" />
              <path d="M481 -20 C491 148 472 295 486 435 C498 575 478 711 492 920" />
              <path d="M648 -30 C638 145 662 294 645 440 C630 571 657 713 644 925" />
            </g>

            <g className="map-street-labels" fill="#9b9d91" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="700" letterSpacing="2">
              <text x="202" y="165" transform="rotate(-2 202 165)">WILLOW STREET</text>
              <text x="196" y="422" transform="rotate(1 196 422)">OAK AVENUE</text>
              <text x="199" y="574" transform="rotate(-2 199 574)">PINE STREET</text>
              <text x="503" y="200" transform="rotate(90 503 200)">5TH AVENUE</text>
              <text x="663" y="464" transform="rotate(89 663 464)">RIVER WALK</text>
              <text x="880" y="458" transform="rotate(-2 880 458)">PARKSIDE ROAD</text>
            </g>

            <g className="route-lines" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path
                d={selectedRoute === "fast"
                  ? "M287 619 C320 573 332 519 328 447 C321 383 342 342 365 296 C398 239 430 214 487 198 C569 176 627 198 677 222 C726 246 753 275 791 302 C833 331 875 337 923 316"
                  : selectedRoute === "balanced"
                    ? "M287 619 C328 588 353 548 351 501 C348 452 337 416 355 373 C376 321 422 296 477 294 C540 291 580 300 632 309 C684 318 712 339 754 367 C802 399 847 402 885 376 C904 361 912 339 923 316"
                    : "M287 619 C327 599 359 577 378 538 C396 500 385 465 402 432 C420 397 454 383 490 385 C535 387 568 404 606 409 C647 414 681 405 713 385 C754 359 777 331 812 313 C849 295 886 298 923 316"}
                stroke="rgba(255,255,255,.92)"
                strokeWidth="15"
              />
              <path
                d={selectedRoute === "fast"
                  ? "M287 619 C320 573 332 519 328 447 C321 383 342 342 365 296 C398 239 430 214 487 198 C569 176 627 198 677 222 C726 246 753 275 791 302 C833 331 875 337 923 316"
                  : selectedRoute === "balanced"
                    ? "M287 619 C328 588 353 548 351 501 C348 452 337 416 355 373 C376 321 422 296 477 294 C540 291 580 300 632 309 C684 318 712 339 754 367 C802 399 847 402 885 376 C904 361 912 339 923 316"
                    : "M287 619 C327 599 359 577 378 538 C396 500 385 465 402 432 C420 397 454 383 490 385 C535 387 568 404 606 409 C647 414 681 405 713 385 C754 359 777 331 812 313 C849 295 886 298 923 316"}
                stroke={selectedRoute === "quiet" ? "#19876f" : selectedRoute === "balanced" ? "#4684c5" : "#df9a43"}
                strokeWidth="7"
              />
            </g>

            <g className="map-origin" transform="translate(287 619)">
              <circle r="20" fill="rgba(25,135,111,.17)" />
              <circle r="10" fill="#fff" />
              <circle r="6" fill="#19876f" />
            </g>
            <g className="map-destination" transform="translate(923 316)">
              <circle r="26" fill="rgba(25,135,111,.13)" />
              <path d="M0 -19 C-10 -19 -17 -12 -17 -3 C-17 8 0 23 0 23 C0 23 17 8 17 -3 C17 -12 10 -19 0 -19Z" fill="#16866e" />
              <circle cy="-4" r="6" fill="#fff" />
            </g>
            <g className="map-label-pills" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="700">
              <g transform="translate(225 657)">
                <rect width="122" height="31" rx="15.5" fill="#fff" />
                <text x="61" y="20" fill="#334155" textAnchor="middle">YOUR START</text>
              </g>
              <g transform="translate(854 270)">
                <rect width="154" height="31" rx="15.5" fill="#fff" />
                <text x="77" y="20" fill="#334155" textAnchor="middle">RIVERSIDE PARK</text>
              </g>
            </g>
          </svg>

          <div className="map-topline">
            <div className="map-place-badge">
              <span className="map-place-icon"><MapPin size={15} /></span>
              <span><strong>Portland, Oregon</strong><small>Illustrative neighborhood</small></span>
            </div>
            <div className="map-action-group">
              <button type="button" onClick={() => setMapZoom((zoom) => Math.min(1.35, zoom + 0.1))} aria-label="Zoom in"><Plus size={17} /></button>
              <button type="button" onClick={() => setMapZoom((zoom) => Math.max(0.9, zoom - 0.1))} aria-label="Zoom out"><Minus size={17} /></button>
              <span className="map-action-divider" />
              <button type="button" onClick={() => setMapZoom(1)} aria-label="Reset map view"><LocateFixed size={16} /></button>
            </div>
          </div>

          <div className="map-bottomline">
            <div className="map-key">
              <span className={`map-key-line key-${selectedRoute}`} />
              <span>{activeRoute.name}</span>
              <span className="map-key-divider" />
              <span className="map-key-pin"><MapPin size={13} /></span>
              <span>Destination</span>
            </div>
            <div className="map-preview-badge"><span /> SAMPLE MAP · NOT FOR NAVIGATION</div>
          </div>

          <div className="map-center-caption">
            <span className="caption-leaf"><TreePine size={17} /></span>
            <span><strong>Riverside Park</strong><small>A little more green on your way</small></span>
            <ArrowUpRight size={16} />
          </div>

          <div className="map-attribution">Illustrative map preview · Map data will be connected in a future step</div>
        </section>
      </div>
    </main>
  );
}