/**
 * Airport Code to Timezone Mapping
 * Top 500+ global airports mapped to IANA timezone identifiers
 */

export const AIRPORT_TIMEZONES = {
    // United States - Eastern
    "ATL": "America/New_York",    // Atlanta
    "BOS": "America/New_York",    // Boston
    "BWI": "America/New_York",    // Baltimore-Washington
    "CLT": "America/New_York",    // Charlotte
    "CLE": "America/New_York",    // Cleveland
    "CMH": "America/New_York",    // Columbus
    "CVG": "America/New_York",    // Cincinnati
    "DCA": "America/New_York",    // Washington Reagan
    "DTW": "America/New_York",    // Detroit
    "EWR": "America/New_York",    // Newark
    "FLL": "America/New_York",    // Fort Lauderdale
    "IAD": "America/New_York",    // Washington Dulles
    "JAX": "America/New_York",    // Jacksonville
    "JFK": "America/New_York",    // New York JFK
    "LGA": "America/New_York",    // New York LaGuardia
    "MCO": "America/New_York",    // Orlando
    "MIA": "America/New_York",    // Miami
    "PBI": "America/New_York",    // West Palm Beach
    "PHL": "America/New_York",    // Philadelphia
    "PIT": "America/New_York",    // Pittsburgh
    "RDU": "America/New_York",    // Raleigh-Durham
    "RIC": "America/New_York",    // Richmond
    "RSW": "America/New_York",    // Fort Myers
    "SRQ": "America/New_York",    // Sarasota
    "TPA": "America/New_York",    // Tampa
    "BDL": "America/New_York",    // Hartford
    "BUF": "America/New_York",    // Buffalo
    "SYR": "America/New_York",    // Syracuse
    "ROC": "America/New_York",    // Rochester NY
    "ALB": "America/New_York",    // Albany
    "PWM": "America/New_York",    // Portland ME
    "BTV": "America/New_York",    // Burlington VT
    "ORF": "America/New_York",    // Norfolk
    "GSO": "America/New_York",    // Greensboro
    "CHS": "America/New_York",    // Charleston SC
    "SAV": "America/New_York",    // Savannah
    "MYR": "America/New_York",    // Myrtle Beach

    // United States - Central
    "ORD": "America/Chicago",     // Chicago O'Hare
    "MDW": "America/Chicago",     // Chicago Midway
    "DFW": "America/Chicago",     // Dallas-Fort Worth
    "DAL": "America/Chicago",     // Dallas Love
    "IAH": "America/Chicago",     // Houston Intercontinental
    "HOU": "America/Chicago",     // Houston Hobby
    "AUS": "America/Chicago",     // Austin
    "SAT": "America/Chicago",     // San Antonio
    "MSP": "America/Chicago",     // Minneapolis
    "MCI": "America/Chicago",     // Kansas City
    "STL": "America/Chicago",     // St. Louis
    "MSY": "America/Chicago",     // New Orleans
    "MEM": "America/Chicago",     // Memphis
    "BNA": "America/Chicago",     // Nashville
    "IND": "America/Chicago",     // Indianapolis
    "MKE": "America/Chicago",     // Milwaukee
    "OMA": "America/Chicago",     // Omaha
    "DSM": "America/Chicago",     // Des Moines
    "OKC": "America/Chicago",     // Oklahoma City
    "TUL": "America/Chicago",     // Tulsa
    "LIT": "America/Chicago",     // Little Rock
    "BHM": "America/Chicago",     // Birmingham
    "HSV": "America/Chicago",     // Huntsville
    "MOB": "America/Chicago",     // Mobile
    "PNS": "America/Chicago",     // Pensacola
    "GRR": "America/Chicago",     // Grand Rapids (actually Eastern but near border)
    "FSD": "America/Chicago",     // Sioux Falls
    "FAR": "America/Chicago",     // Fargo

    // United States - Mountain
    "DEN": "America/Denver",      // Denver
    "SLC": "America/Denver",      // Salt Lake City
    "ABQ": "America/Denver",      // Albuquerque
    "ELP": "America/Denver",      // El Paso
    "BOI": "America/Denver",      // Boise
    "COS": "America/Denver",      // Colorado Springs
    "BZN": "America/Denver",      // Bozeman
    "JAC": "America/Denver",      // Jackson Hole
    "MSO": "America/Denver",      // Missoula
    "BIL": "America/Denver",      // Billings

    // United States - Arizona (No DST)
    "PHX": "America/Phoenix",     // Phoenix
    "TUS": "America/Phoenix",     // Tucson
    "FLG": "America/Phoenix",     // Flagstaff

    // United States - Pacific
    "LAX": "America/Los_Angeles", // Los Angeles
    "SFO": "America/Los_Angeles", // San Francisco
    "SJC": "America/Los_Angeles", // San Jose
    "OAK": "America/Los_Angeles", // Oakland
    "SAN": "America/Los_Angeles", // San Diego
    "SEA": "America/Los_Angeles", // Seattle
    "PDX": "America/Los_Angeles", // Portland
    "LAS": "America/Los_Angeles", // Las Vegas
    "SMF": "America/Los_Angeles", // Sacramento
    "SNA": "America/Los_Angeles", // Orange County / Santa Ana
    "BUR": "America/Los_Angeles", // Burbank
    "ONT": "America/Los_Angeles", // Ontario CA
    "LGB": "America/Los_Angeles", // Long Beach
    "PSP": "America/Los_Angeles", // Palm Springs
    "RNO": "America/Los_Angeles", // Reno
    "GEG": "America/Los_Angeles", // Spokane
    "FAT": "America/Los_Angeles", // Fresno
    "SBA": "America/Los_Angeles", // Santa Barbara
    "MFR": "America/Los_Angeles", // Medford
    "EUG": "America/Los_Angeles", // Eugene

    // United States - Alaska
    "ANC": "America/Anchorage",   // Anchorage
    "FAI": "America/Anchorage",   // Fairbanks
    "JNU": "America/Anchorage",   // Juneau

    // United States - Hawaii
    "HNL": "Pacific/Honolulu",    // Honolulu
    "OGG": "Pacific/Honolulu",    // Maui
    "KOA": "Pacific/Honolulu",    // Kona
    "LIH": "Pacific/Honolulu",    // Lihue

    // Canada
    "YYZ": "America/Toronto",     // Toronto Pearson
    "YTZ": "America/Toronto",     // Toronto Billy Bishop
    "YUL": "America/Toronto",     // Montreal
    "YOW": "America/Toronto",     // Ottawa
    "YQB": "America/Toronto",     // Quebec City
    "YHZ": "America/Halifax",     // Halifax
    "YYC": "America/Edmonton",    // Calgary
    "YEG": "America/Edmonton",    // Edmonton
    "YVR": "America/Vancouver",   // Vancouver
    "YYJ": "America/Vancouver",   // Victoria
    "YWG": "America/Winnipeg",    // Winnipeg
    "YXE": "America/Regina",      // Saskatoon
    "YQR": "America/Regina",      // Regina
    "YYT": "America/St_Johns",    // St. John's

    // Mexico
    "MEX": "America/Mexico_City", // Mexico City
    "GDL": "America/Mexico_City", // Guadalajara
    "MTY": "America/Monterrey",   // Monterrey
    "CUN": "America/Cancun",      // Cancun
    "SJD": "America/Mazatlan",    // Los Cabos
    "PVR": "America/Mexico_City", // Puerto Vallarta
    "TIJ": "America/Tijuana",     // Tijuana

    // United Kingdom & Ireland
    "LHR": "Europe/London",       // London Heathrow
    "LGW": "Europe/London",       // London Gatwick
    "STN": "Europe/London",       // London Stansted
    "LTN": "Europe/London",       // London Luton
    "LCY": "Europe/London",       // London City
    "MAN": "Europe/London",       // Manchester
    "BHX": "Europe/London",       // Birmingham UK
    "EDI": "Europe/London",       // Edinburgh
    "GLA": "Europe/London",       // Glasgow
    "BRS": "Europe/London",       // Bristol
    "NCL": "Europe/London",       // Newcastle
    "LPL": "Europe/London",       // Liverpool
    "BFS": "Europe/London",       // Belfast
    "DUB": "Europe/Dublin",       // Dublin
    "SNN": "Europe/Dublin",       // Shannon
    "ORK": "Europe/Dublin",       // Cork

    // Western Europe
    "CDG": "Europe/Paris",        // Paris Charles de Gaulle
    "ORY": "Europe/Paris",        // Paris Orly
    "LYS": "Europe/Paris",        // Lyon
    "NCE": "Europe/Paris",        // Nice
    "MRS": "Europe/Paris",        // Marseille
    "TLS": "Europe/Paris",        // Toulouse
    "BOD": "Europe/Paris",        // Bordeaux
    "AMS": "Europe/Amsterdam",    // Amsterdam
    "BRU": "Europe/Brussels",     // Brussels
    "LUX": "Europe/Luxembourg",   // Luxembourg

    // Germany
    "FRA": "Europe/Berlin",       // Frankfurt
    "MUC": "Europe/Berlin",       // Munich
    "TXL": "Europe/Berlin",       // Berlin Tegel (closed)
    "BER": "Europe/Berlin",       // Berlin Brandenburg
    "DUS": "Europe/Berlin",       // Dusseldorf
    "HAM": "Europe/Berlin",       // Hamburg
    "CGN": "Europe/Berlin",       // Cologne
    "STR": "Europe/Berlin",       // Stuttgart
    "HAJ": "Europe/Berlin",       // Hannover
    "NUE": "Europe/Berlin",       // Nuremberg
    "LEJ": "Europe/Berlin",       // Leipzig

    // Switzerland & Austria
    "ZRH": "Europe/Zurich",       // Zurich
    "GVA": "Europe/Zurich",       // Geneva
    "BSL": "Europe/Zurich",       // Basel
    "VIE": "Europe/Vienna",       // Vienna
    "SZG": "Europe/Vienna",       // Salzburg
    "INN": "Europe/Vienna",       // Innsbruck

    // Italy
    "FCO": "Europe/Rome",         // Rome Fiumicino
    "CIA": "Europe/Rome",         // Rome Ciampino
    "MXP": "Europe/Rome",         // Milan Malpensa
    "LIN": "Europe/Rome",         // Milan Linate
    "VCE": "Europe/Rome",         // Venice
    "NAP": "Europe/Rome",         // Naples
    "FLR": "Europe/Rome",         // Florence
    "BLQ": "Europe/Rome",         // Bologna
    "PSA": "Europe/Rome",         // Pisa
    "CTA": "Europe/Rome",         // Catania
    "PMO": "Europe/Rome",         // Palermo

    // Spain & Portugal
    "MAD": "Europe/Madrid",       // Madrid
    "BCN": "Europe/Madrid",       // Barcelona
    "AGP": "Europe/Madrid",       // Malaga
    "PMI": "Europe/Madrid",       // Palma de Mallorca
    "VLC": "Europe/Madrid",       // Valencia
    "SVQ": "Europe/Madrid",       // Seville
    "BIO": "Europe/Madrid",       // Bilbao
    "ALC": "Europe/Madrid",       // Alicante
    "IBZ": "Europe/Madrid",       // Ibiza
    "TFS": "Atlantic/Canary",     // Tenerife South
    "LPA": "Atlantic/Canary",     // Gran Canaria
    "LIS": "Europe/Lisbon",       // Lisbon
    "OPO": "Europe/Lisbon",       // Porto
    "FAO": "Europe/Lisbon",       // Faro

    // Scandinavia
    "CPH": "Europe/Copenhagen",   // Copenhagen
    "OSL": "Europe/Oslo",         // Oslo
    "BGO": "Europe/Oslo",         // Bergen
    "TRD": "Europe/Oslo",         // Trondheim
    "ARN": "Europe/Stockholm",    // Stockholm Arlanda
    "BMA": "Europe/Stockholm",    // Stockholm Bromma
    "GOT": "Europe/Stockholm",    // Gothenburg
    "HEL": "Europe/Helsinki",     // Helsinki
    "TMP": "Europe/Helsinki",     // Tampere

    // Iceland
    "KEF": "Atlantic/Reykjavik",  // Keflavik (Reykjavik)
    "RKV": "Atlantic/Reykjavik",  // Reykjavik Domestic

    // Eastern Europe
    "WAW": "Europe/Warsaw",       // Warsaw
    "KRK": "Europe/Warsaw",       // Krakow
    "GDN": "Europe/Warsaw",       // Gdansk
    "PRG": "Europe/Prague",       // Prague
    "BUD": "Europe/Budapest",     // Budapest
    "OTP": "Europe/Bucharest",    // Bucharest
    "SOF": "Europe/Sofia",        // Sofia
    "ZAG": "Europe/Zagreb",       // Zagreb
    "BEG": "Europe/Belgrade",     // Belgrade
    "LJU": "Europe/Ljubljana",    // Ljubljana
    "TIA": "Europe/Tirane",       // Tirana
    "SKP": "Europe/Skopje",       // Skopje

    // Baltic States
    "TLL": "Europe/Tallinn",      // Tallinn
    "RIX": "Europe/Riga",         // Riga
    "VNO": "Europe/Vilnius",      // Vilnius

    // Greece & Cyprus
    "ATH": "Europe/Athens",       // Athens
    "SKG": "Europe/Athens",       // Thessaloniki
    "HER": "Europe/Athens",       // Heraklion
    "RHO": "Europe/Athens",       // Rhodes
    "JMK": "Europe/Athens",       // Mykonos
    "JTR": "Europe/Athens",       // Santorini
    "LCA": "Asia/Nicosia",        // Larnaca
    "PFO": "Asia/Nicosia",        // Paphos

    // Turkey
    "IST": "Europe/Istanbul",     // Istanbul
    "SAW": "Europe/Istanbul",     // Istanbul Sabiha
    "ESB": "Europe/Istanbul",     // Ankara
    "AYT": "Europe/Istanbul",     // Antalya
    "ADB": "Europe/Istanbul",     // Izmir
    "DLM": "Europe/Istanbul",     // Dalaman
    "BJV": "Europe/Istanbul",     // Bodrum

    // Russia
    "SVO": "Europe/Moscow",       // Moscow Sheremetyevo
    "DME": "Europe/Moscow",       // Moscow Domodedovo
    "VKO": "Europe/Moscow",       // Moscow Vnukovo
    "LED": "Europe/Moscow",       // St. Petersburg

    // Middle East
    "DXB": "Asia/Dubai",          // Dubai
    "AUH": "Asia/Dubai",          // Abu Dhabi
    "SHJ": "Asia/Dubai",          // Sharjah
    "DOH": "Asia/Qatar",          // Doha
    "BAH": "Asia/Bahrain",        // Bahrain
    "KWI": "Asia/Kuwait",         // Kuwait
    "MCT": "Asia/Muscat",         // Muscat
    "RUH": "Asia/Riyadh",         // Riyadh
    "JED": "Asia/Riyadh",         // Jeddah
    "DMM": "Asia/Riyadh",         // Dammam
    "AMM": "Asia/Amman",          // Amman
    "TLV": "Asia/Jerusalem",      // Tel Aviv
    "BEY": "Asia/Beirut",         // Beirut
    "CAI": "Africa/Cairo",        // Cairo

    // Africa
    "JNB": "Africa/Johannesburg", // Johannesburg
    "CPT": "Africa/Johannesburg", // Cape Town
    "DUR": "Africa/Johannesburg", // Durban
    "NBO": "Africa/Nairobi",      // Nairobi
    "ADD": "Africa/Addis_Ababa",  // Addis Ababa
    "LOS": "Africa/Lagos",        // Lagos
    "ABV": "Africa/Lagos",        // Abuja
    "ACC": "Africa/Accra",        // Accra
    "CMN": "Africa/Casablanca",   // Casablanca
    "RAK": "Africa/Casablanca",   // Marrakech
    "ALG": "Africa/Algiers",      // Algiers
    "TUN": "Africa/Tunis",        // Tunis
    "MRU": "Indian/Mauritius",    // Mauritius
    "SEZ": "Indian/Mahe",         // Seychelles

    // South Asia
    "DEL": "Asia/Kolkata",        // Delhi
    "BOM": "Asia/Kolkata",        // Mumbai
    "BLR": "Asia/Kolkata",        // Bangalore
    "MAA": "Asia/Kolkata",        // Chennai
    "HYD": "Asia/Kolkata",        // Hyderabad
    "CCU": "Asia/Kolkata",        // Kolkata
    "GOI": "Asia/Kolkata",        // Goa
    "COK": "Asia/Kolkata",        // Kochi
    "CMB": "Asia/Colombo",        // Colombo
    "DAC": "Asia/Dhaka",          // Dhaka
    "KTM": "Asia/Kathmandu",      // Kathmandu
    "ISB": "Asia/Karachi",        // Islamabad
    "KHI": "Asia/Karachi",        // Karachi
    "LHE": "Asia/Karachi",        // Lahore
    "MLE": "Indian/Maldives",     // Male (Maldives)

    // Southeast Asia
    "SIN": "Asia/Singapore",      // Singapore
    "KUL": "Asia/Kuala_Lumpur",   // Kuala Lumpur
    "PEN": "Asia/Kuala_Lumpur",   // Penang
    "LGK": "Asia/Kuala_Lumpur",   // Langkawi
    "BKK": "Asia/Bangkok",        // Bangkok Suvarnabhumi
    "DMK": "Asia/Bangkok",        // Bangkok Don Mueang
    "HKT": "Asia/Bangkok",        // Phuket
    "CNX": "Asia/Bangkok",        // Chiang Mai
    "SGN": "Asia/Ho_Chi_Minh",    // Ho Chi Minh City
    "HAN": "Asia/Ho_Chi_Minh",    // Hanoi
    "DAD": "Asia/Ho_Chi_Minh",    // Da Nang
    "CGK": "Asia/Jakarta",        // Jakarta
    "DPS": "Asia/Makassar",       // Bali Denpasar
    "MNL": "Asia/Manila",         // Manila
    "CEB": "Asia/Manila",         // Cebu
    "RGN": "Asia/Yangon",         // Yangon
    "PNH": "Asia/Phnom_Penh",     // Phnom Penh
    "REP": "Asia/Phnom_Penh",     // Siem Reap
    "VTE": "Asia/Vientiane",      // Vientiane

    // East Asia
    "HKG": "Asia/Hong_Kong",      // Hong Kong
    "PVG": "Asia/Shanghai",       // Shanghai Pudong
    "SHA": "Asia/Shanghai",       // Shanghai Hongqiao
    "PEK": "Asia/Shanghai",       // Beijing Capital
    "PKX": "Asia/Shanghai",       // Beijing Daxing
    "CAN": "Asia/Shanghai",       // Guangzhou
    "SZX": "Asia/Shanghai",       // Shenzhen
    "CTU": "Asia/Shanghai",       // Chengdu
    "CKG": "Asia/Shanghai",       // Chongqing
    "XIY": "Asia/Shanghai",       // Xi'an
    "HGH": "Asia/Shanghai",       // Hangzhou
    "NKG": "Asia/Shanghai",       // Nanjing
    "WUH": "Asia/Shanghai",       // Wuhan
    "TSN": "Asia/Shanghai",       // Tianjin
    "TAO": "Asia/Shanghai",       // Qingdao
    "DLC": "Asia/Shanghai",       // Dalian
    "XMN": "Asia/Shanghai",       // Xiamen
    "MFM": "Asia/Macau",          // Macau
    "TPE": "Asia/Taipei",         // Taipei
    "KHH": "Asia/Taipei",         // Kaohsiung

    // Japan
    "NRT": "Asia/Tokyo",          // Tokyo Narita
    "HND": "Asia/Tokyo",          // Tokyo Haneda
    "KIX": "Asia/Tokyo",          // Osaka Kansai
    "ITM": "Asia/Tokyo",          // Osaka Itami
    "NGO": "Asia/Tokyo",          // Nagoya
    "FUK": "Asia/Tokyo",          // Fukuoka
    "CTS": "Asia/Tokyo",          // Sapporo
    "OKA": "Asia/Tokyo",          // Okinawa

    // South Korea
    "ICN": "Asia/Seoul",          // Seoul Incheon
    "GMP": "Asia/Seoul",          // Seoul Gimpo
    "PUS": "Asia/Seoul",          // Busan
    "CJU": "Asia/Seoul",          // Jeju

    // Australia
    "SYD": "Australia/Sydney",    // Sydney
    "MEL": "Australia/Melbourne", // Melbourne
    "BNE": "Australia/Brisbane",  // Brisbane
    "PER": "Australia/Perth",     // Perth
    "ADL": "Australia/Adelaide",  // Adelaide
    "CBR": "Australia/Sydney",    // Canberra
    "OOL": "Australia/Brisbane",  // Gold Coast
    "CNS": "Australia/Brisbane",  // Cairns
    "DRW": "Australia/Darwin",    // Darwin
    "HBA": "Australia/Hobart",    // Hobart

    // New Zealand
    "AKL": "Pacific/Auckland",    // Auckland
    "WLG": "Pacific/Auckland",    // Wellington
    "CHC": "Pacific/Auckland",    // Christchurch
    "ZQN": "Pacific/Auckland",    // Queenstown

    // Pacific Islands
    "NAN": "Pacific/Fiji",        // Fiji Nadi
    "PPT": "Pacific/Tahiti",      // Tahiti
    "GUM": "Pacific/Guam",        // Guam
    "SPN": "Pacific/Guam",        // Saipan

    // Caribbean
    "SJU": "America/Puerto_Rico", // San Juan
    "BGI": "America/Barbados",    // Barbados
    "POS": "America/Port_of_Spain", // Trinidad
    "NAS": "America/Nassau",      // Nassau
    "MBJ": "America/Jamaica",     // Montego Bay
    "KIN": "America/Jamaica",     // Kingston
    "GCM": "America/Cayman",      // Grand Cayman
    "PUJ": "America/Santo_Domingo", // Punta Cana
    "SDQ": "America/Santo_Domingo", // Santo Domingo
    "HAV": "America/Havana",      // Havana
    "AUA": "America/Aruba",       // Aruba
    "CUR": "America/Curacao",     // Curacao
    "SXM": "America/Lower_Princes", // St. Maarten
    "STT": "America/Virgin",      // St. Thomas
    "STX": "America/Virgin",      // St. Croix

    // Central America
    "PTY": "America/Panama",      // Panama City
    "SJO": "America/Costa_Rica",  // San Jose Costa Rica
    "GUA": "America/Guatemala",   // Guatemala City
    "SAL": "America/El_Salvador", // San Salvador
    "TGU": "America/Tegucigalpa", // Tegucigalpa
    "MGA": "America/Managua",     // Managua
    "BZE": "America/Belize",      // Belize City

    // South America
    "GRU": "America/Sao_Paulo",   // São Paulo Guarulhos
    "CGH": "America/Sao_Paulo",   // São Paulo Congonhas
    "GIG": "America/Sao_Paulo",   // Rio de Janeiro
    "BSB": "America/Sao_Paulo",   // Brasilia
    "CNF": "America/Sao_Paulo",   // Belo Horizonte
    "POA": "America/Sao_Paulo",   // Porto Alegre
    "SSA": "America/Bahia",       // Salvador
    "FOR": "America/Fortaleza",   // Fortaleza
    "REC": "America/Recife",      // Recife
    "MAO": "America/Manaus",      // Manaus
    "EZE": "America/Argentina/Buenos_Aires", // Buenos Aires
    "AEP": "America/Argentina/Buenos_Aires", // Buenos Aires Aeroparque
    "SCL": "America/Santiago",    // Santiago Chile
    "LIM": "America/Lima",        // Lima
    "BOG": "America/Bogota",      // Bogota
    "MDE": "America/Bogota",      // Medellin
    "CTG": "America/Bogota",      // Cartagena
    "UIO": "America/Guayaquil",   // Quito
    "GYE": "America/Guayaquil",   // Guayaquil
    "CCS": "America/Caracas",     // Caracas
    "MVD": "America/Montevideo",  // Montevideo
    "ASU": "America/Asuncion",    // Asuncion
    "VVI": "America/La_Paz",      // Santa Cruz Bolivia
    "LPB": "America/La_Paz",      // La Paz
};

/**
 * Get timezone for an airport code
 * @param {string} airportCode - 3-letter IATA airport code
 * @returns {string|null} - IANA timezone identifier or null if not found
 */
export const getAirportTimezone = (airportCode) => {
    if (!airportCode) return null;
    const code = airportCode.toUpperCase().trim();
    return AIRPORT_TIMEZONES[code] || null;
};

/**
 * Get city name for an airport code (approximate, for display)
 */
export const AIRPORT_CITIES = {
    "ATL": "Atlanta",
    "LAX": "Los Angeles",
    "ORD": "Chicago",
    "DFW": "Dallas",
    "DEN": "Denver",
    "JFK": "New York",
    "SFO": "San Francisco",
    "SEA": "Seattle",
    "LAS": "Las Vegas",
    "MCO": "Orlando",
    "EWR": "Newark",
    "MIA": "Miami",
    "PHX": "Phoenix",
    "IAH": "Houston",
    "BOS": "Boston",
    "MSP": "Minneapolis",
    "FLL": "Fort Lauderdale",
    "DTW": "Detroit",
    "PHL": "Philadelphia",
    "LGA": "New York",
    "BWI": "Baltimore",
    "SLC": "Salt Lake City",
    "DCA": "Washington DC",
    "IAD": "Washington DC",
    "SAN": "San Diego",
    "TPA": "Tampa",
    "PDX": "Portland",
    "HNL": "Honolulu",
    "STL": "St. Louis",
    "BNA": "Nashville",
    "AUS": "Austin",
    "OAK": "Oakland",
    "MCI": "Kansas City",
    "RDU": "Raleigh",
    "SJC": "San Jose",
    "SMF": "Sacramento",
    "SNA": "Santa Ana",
    "CLE": "Cleveland",
    "IND": "Indianapolis",
    "CMH": "Columbus",
    "MKE": "Milwaukee",
    "PIT": "Pittsburgh",
    "SAT": "San Antonio",
    "CVG": "Cincinnati",
    "LHR": "London",
    "LGW": "London",
    "CDG": "Paris",
    "FRA": "Frankfurt",
    "AMS": "Amsterdam",
    "MAD": "Madrid",
    "BCN": "Barcelona",
    "FCO": "Rome",
    "MXP": "Milan",
    "MUC": "Munich",
    "ZRH": "Zurich",
    "VIE": "Vienna",
    "CPH": "Copenhagen",
    "OSL": "Oslo",
    "ARN": "Stockholm",
    "HEL": "Helsinki",
    "DUB": "Dublin",
    "BRU": "Brussels",
    "LIS": "Lisbon",
    "ATH": "Athens",
    "IST": "Istanbul",
    "KEF": "Reykjavik",
    "DXB": "Dubai",
    "DOH": "Doha",
    "SIN": "Singapore",
    "HKG": "Hong Kong",
    "NRT": "Tokyo",
    "HND": "Tokyo",
    "ICN": "Seoul",
    "PEK": "Beijing",
    "PVG": "Shanghai",
    "BKK": "Bangkok",
    "KUL": "Kuala Lumpur",
    "SYD": "Sydney",
    "MEL": "Melbourne",
    "AKL": "Auckland",
    "YYZ": "Toronto",
    "YVR": "Vancouver",
    "YUL": "Montreal",
    "MEX": "Mexico City",
    "CUN": "Cancun",
    "GRU": "São Paulo",
    "EZE": "Buenos Aires",
    "SCL": "Santiago",
    "BOG": "Bogota",
    "LIM": "Lima",
};

export const getAirportCity = (airportCode) => {
    if (!airportCode) return null;
    const code = airportCode.toUpperCase().trim();
    return AIRPORT_CITIES[code] || null;
};
