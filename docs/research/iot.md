# IoT: risk, reward and how to de-risk

Evidence on how hardware and IoT entries fare, what fails in live demos, what parts and platforms cost in Malaysia, and which Malaysian rules apply to a township pilot, as of 2026-10-10. It tests our hunch that IoT is high risk and high reward in a hackathon. Prices are Malaysian store listings checked on 2026-10-10.

Contents:

1.  [Verdict on the hunch](#verdict-on-the-hunch)
1.  [What this hackathon's format changes](#what-this-hackathons-format-changes)
1.  [Showing township scale without building it](#showing-township-scale-without-building-it)
1.  [Demo reliability](#demo-reliability)
1.  [Parts and platforms in Malaysia](#parts-and-platforms-in-malaysia)
1.  [Malaysian rules for a pilot](#malaysian-rules-for-a-pilot)
1.  [IoT pilots in Malaysian townships](#iot-pilots-in-malaysian-townships)
1.  [A go or no-go test](#a-go-or-no-go-test)
1.  [Unverified and not found](#unverified-and-not-found)
1.  [See also](#see-also)

## Verdict on the hunch

The reward is real but unproven, and in this format the risk is smaller than usual.

- **Hardware does win.** Recent Malaysian winners include a smart manhole for flood prevention (Varsity Hackathon 2025), a solar-powered IoT fishing-net recycler (UNDP 2025) and two IoT energy and carbon startups (MYCentre4IR 2024); CapitaLand's recent winners are mostly hardware or retrofits with AI as the control layer ([Past winners](/docs/research/past-winners.md)).
- **No study shows hardware wins more often.** A survey of 356 health-hackathon projects found 61% included hardware but didn't compare outcomes ([BMJ Innovations, 2017][bmj]). Of 22 named Malaysian winners from 2024 to 2026, 4 clearly used hardware and 7 were software only ([Past winners](/docs/research/past-winners.md#hardware-versus-software)).
- **Live demos leave little room to recover.** New York City's hackathon guide gives each team 2 to 3 minutes for setup, 3 for the demo and 3 to 4 for questions ([NYC guide][nyc]). TAMUhack 2026 scores "Was the demo seamless?" ([Devpost][tamu]).
- **The organisers lowered the bar for hardware.** "We are not expecting you all to build something out of your own money... and build hardware... A lot of simulations can be done" (Siva, 56:54); a cardboard model or software also counts (Dr Lam, 57:38) ([briefing transcript](/docs/sources/opening-briefing/transcript.md)).

[bmj]: https://irdash.must.ac.ug/server/api/core/bitstreams/6c6f361f-e057-4a04-a462-882e8921602f/content
[nyc]: https://www.nyc.gov/html/hackathon/html/design.html
[tamu]: https://th26.devpost.com/?ref_content=default&ref_feature=challenge&ref_medium=portfolio

## What this hackathon's format changes

Each point is our inference from [BRIEF](/docs/BRIEF.md).

- **Round 1 is a recorded 5-minute video plus a prototype link,** due 23 October. A video can be re-shot until it works, so the classic live-demo failure doesn't apply to the first cut.
- **Live risk starts only in the Top 10:** the 14 November pitch and the 3 December booth at Elmina. By then the mentoring sprint (2 to 6 November) gives time to harden the build, and the organisers say they will arrange physical prototypes for finalists (Dr Lam, 58:38).
- **The real risk moves earlier:** parts arriving late, a sensor that won't calibrate, or a build that eats the time needed for user evidence and the deck, which together carry 35% of the marks (impact evidence plus team, evidence and pitch).

## Showing township scale without building it

- **Partial digital twins are legitimate.** NIST describes a digital twin as a virtual representation that can be partial and purpose-built from relevant data and models ([NIST][nist]). The EU's Local Digital Twin Toolbox frames city twins as tools for "simulation rather than real-time operations" ([EU toolbox][eu-ldt]).
- **Simulators:** Wokwi simulates ESP32 boards and their firmware, and its virtual DHT22 sensor lets you change temperature and humidity during a run ([Wokwi ESP32][wokwi-esp32]; [Wokwi DHT22][wokwi-dht]).
- **Wizard of Oz:** a 2026 review of 194 HCI papers describes prototypes that look automatic but are run by a hidden person ([CHI 2026 review, excerpt][woz]).
- Inference: one real node that collects genuine local readings, plus a twin that replays clearly labelled real data for the rest of the township, shows scale honestly. No winner's write-up documented this exact format.

[nist]: https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=932289
[eu-ldt]: https://interoperable-europe.ec.europa.eu/collection/ldttoolbox?page=0
[wokwi-esp32]: https://docs.wokwi.com/guides/esp32
[wokwi-dht]: https://docs.wokwi.com/parts/wokwi-dht22
[woz]: https://hub.hku.hk/handle/10722/376290

## Demo reliability

These come from organiser guides and one practitioner, not measured studies.

- Rehearse the demo path ten times, freeze features two hours before judging, carry a mobile hotspot and keep a short screen recording as a fallback ([Pranjul Rathour, 2025][rathour]).
- Ask for power and internet in advance and download large files beforehand; booth power may be shared ([Maker Faire manual][makerfaire]).
- Bring a camera or visualiser and display adapters for hardware ([UK Hackathons][ukhack]).
- A local gateway avoids venue Wi-Fi: Dragino's LPS8v2 LoRaWAN gateway has a built-in server that works without a cloud service ([Myduino][lps8]).

[rathour]: https://pranjulrathour.scult.in/blog/hackathon-demo-that-works-live
[makerfaire]: https://oc.makerfaire.com/maker-manual/
[ukhack]: https://hack.athon.uk/organise/during/demos/
[lps8]: https://myduino.com/product/drg-051/

## Parts and platforms in Malaysia

| Item                                    | Price, checked 2026-10-10 | Source           |
| --------------------------------------- | ------------------------- | ---------------- |
| Maker ESP32 bundle                      | RM29.00                   | [Cytron][cytron] |
| Robo ESP32 kit                          | RM62.58                   | [Cytron][cytron] |
| Maker UNO (Arduino-compatible)          | RM37.80                   | [Cytron][cytron] |
| Raspberry Pi 5 (RAM size not stated)    | RM202.00                  | [Cytron][cytron] |
| LoRaWAN motion and light sensor         | RM110                     | [Myduino][ws202] |
| LoRaWAN temperature and humidity sensor | RM200                     | [Myduino][lht65] |
| Indoor LoRaWAN gateway (LPS8v2, 4G)     | RM1,390                   | [Myduino][lps8]  |
| Outdoor LoRaWAN gateway (UG67)          | RM5,100                   | [Myduino][ug67]  |

- Cytron offers free shipping in Peninsular Malaysia but shows no stock levels, and its search returned the same unfiltered page for every query, so check stock by phone or chat ([Cytron][cytron]).
- **Off-the-shelf devices avoid wiring mains power.** An energy-monitoring smart plug such as TP-Link's Tapo P110 is sold locally with 3 to 5 working days' delivery ([Allit, excerpt][tapo]). Tapo runs closed firmware, so it needs its own app or cloud integration.

| Platform          | Free tier                                                                            | Source                                                   |
| ----------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| ThingsBoard Cloud | 5 devices, 5 assets, 1 million data points a month                                   | [ThingsBoard][thingsboard]                               |
| Blynk             | 5 devices, 100,000 messages a month, one week of history                             | [Blynk][blynk]                                           |
| Arduino Cloud     | 2 Things, one day of retention                                                       | [Arduino][arduino]                                       |
| Grafana Cloud     | 10,000 active series, 14-day retention, 3 users                                      | [Grafana][grafana]                                       |
| Firebase Spark    | Firestore 20,000 writes and 50,000 reads a day; no Cloud Functions                   | [Firebase][firebase]                                     |
| Wokwi             | Free for public projects; ESP32 Wi-Fi simulated; no Bluetooth on several ESP32 chips | [Wokwi pricing][wokwi-price]; [ESP32 guide][wokwi-esp32] |

- Home Assistant and ESPHome run locally without a cloud ([Home Assistant][ha]; [ESPHome][esphome]); Eclipse Mosquitto is an open-source MQTT broker ([Mosquitto][mosquitto]).

[cytron]: https://my.cytron.io/
[ws202]: https://myduino.com/product/msg-016/
[lht65]: https://myduino.com/product/drg-048/
[ug67]: https://myduino.com/product/msg-035/
[tapo]: https://www.allithypermarket.com.my/products/tp-link-smart-wifi-plug-tapo-p100
[thingsboard]: https://thingsboard.io/pricing/
[blynk]: https://blynk.io/pricing
[arduino]: https://cloud.arduino.cc/plans
[grafana]: https://grafana.com/pricing/
[firebase]: https://firebase.google.com/pricing
[wokwi-price]: https://wokwi.com/pricing
[ha]: https://www.home-assistant.io/
[esphome]: https://esphome.io/
[mosquitto]: https://mosquitto.org/

## Malaysian rules for a pilot

These matter for the feasibility story, not for a prototype on a desk.

- **Radio certification:** MCMC's Class Assignment No. 2 of 2025, in force from 24 June 2025, requires covered devices to be certified by MCMC or a registered certifying agency. It allows special approval for trials, demonstrations, exhibitions and research ([MCMC][mcmc]). SIRIM QAS is an appointed certifying agency ([SIRIM QAS][sirim]).
- **LoRa bands:** the schedule allows 919 to 923 MHz at up to 500 mW EIRP, among other bands; Malaysia uses LoRaWAN's AS923-1 plan, but an AS923 label alone doesn't prove MCMC compliance ([MCMC][mcmc]; [LoRa Alliance][lora]).
- **Electrical work:** anyone who carries out or supervises electrical installation work must be a certified Electrical Competent Person ([Energy Commission][st-cp]). Plug-in, low-voltage devices avoid this question.
- **Personal data:** CCTV images of identifiable people are personal data ([PDP FAQ][pdp-faq]). Since 1 June 2025, controllers need a data protection officer if they hold data on more than 20,000 people or monitor people regularly and systematically ([DPO manual][dpo]), and must report breaches; the 2025 guideline sets a 72-hour outer limit for notifying the Commissioner ([PDPA amendment][pdpa]; [breach guideline, excerpt][dbn]).
- **Common property:** the JMB or management corporation maintains strata common property, so devices there need its agreement ([Strata Management Act][sma]).

[mcmc]: https://www.mcmc.gov.my/skmmgovmy/media/General/pdf2/Class-Assignment-No-2-of-2025.pdf
[sirim]: https://www.sirim-qas.com.my/service/communication-multimedia-and-hybrid-product/
[lora]: https://lora-alliance.org/wp-content/uploads/2021/05/RP002-1.0.3-FINAL-1.pdf
[st-cp]: https://www.st.gov.my/stakeholders/electricity/register-as-competent-person
[pdp-faq]: https://www.pdp.gov.my/ppdpv1/en/faq/
[dpo]: https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2025/07/Manual_Pengguna_Pendaftaran_DPO_EN.pdf
[pdpa]: https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2024/11/Act-A1727.pdf
[dbn]: https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2025/08/GP_DBN_ENG.pdf
[sma]: https://www.ppj.gov.my/storage/7465/Act-757--Strata-Management-Act-2013.pdf

## IoT pilots in Malaysian townships

- **SDP's own history:** in 2019 SDP and TNBX agreed to explore smart green homes at Elmina Grove, covering solar, smart meters and energy management for 513 planned units, with projected rather than measured savings ([SDP, 2019][sdp-tnbx]). No results were published.
- **Councils:** Ampang Jaya council added CCTV, adaptive lights, public Wi-Fi and environmental sensors, and named high development and maintenance costs, staff training and cybersecurity as its challenges ([The Star, August 2025][ampang]).
- **Cyberjaya:** Cyberview describes an IoT urban-farming pilot and LTE-connected traffic signals, without measured results ([Cyberview][cyberview]).
- **Connectivity:** Maxis advertises NB-IoT across the whole Klang Valley, which is a carrier claim, not a site guarantee ([Maxis][maxis]). The Things Network lists a Selangor and Perak community ([TTN][ttn]).

[sdp-tnbx]: https://www.simedarbyproperty.com/elmina-grove/whats-new/2019-09-04-sdp-partners-with-tnb-for-smarter-greener-homes/
[ampang]: https://www.thestar.com.my/metro/metro-news/2025/08/30/local-councils-key-to-digital-drive
[cyberview]: https://www.cyberview.com.my/the-capital/smart-city/
[maxis]: https://www.business.maxis.com.my/en/iot/narrowband-iot/
[ttn]: https://www.thethingsnetwork.org/country/malaysia/

## A go or no-go test

Our inference, for the ideation suite to refine. Use IoT only if all four hold:

1.  **The sensor data is the innovation.** Without the readings, the idea doesn't work. If the sensor is decoration, drop it.
2.  **One node proves it.** A single working node plus real recorded data shows the mechanism; the rest can be a labelled twin.
3.  **Parts are off the shelf and plug-in.** No mains wiring, no custom radio, and delivery confirmed by 14 October.
4.  **The video can be shot by 20 October.** That leaves three days of slack before the 23 October deadline.

## Unverified and not found

- No study compares hardware and software hackathon win rates.
- No postmortem quantifies how often venue Wi-Fi, flashing or calibration breaks demos.
- No winner documents a one-node-plus-replay twin.
- Malaysian prices for most individual sensors, and Pi Zero 2 W stock, weren't found.
- Whether smart plugs need SIRIM or Energy Commission approval to be sold wasn't confirmed.
- Results of the Elmina Grove smart-home plan aren't public.

## See also

- [Past winners](/docs/research/past-winners.md), for hardware winners
- [Energy, HVAC and solar](/docs/research/energy-hvac-solar.md), where sensors would matter most
- [BRIEF, video and prototype](/docs/BRIEF.md#video-and-prototype)
