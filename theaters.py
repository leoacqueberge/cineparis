"""Cinémas du Pass UGC Illimité à Paris (UGC + partenaires, sans Pathé/Gaumont)."""

from __future__ import annotations

THEATERS = [
    # --- UGC ---
    {"id": "C0159", "name": "UGC Ciné Cité Les Halles", "area": "1er", "brand": "ugc", "lat": 48.8622, "lng": 2.3469},
    {"id": "C0126", "name": "UGC Opéra", "area": "9e", "brand": "ugc", "lat": 48.8715, "lng": 2.3320},
    {"id": "C0102", "name": "UGC Danton", "area": "6e", "brand": "ugc", "lat": 48.8510, "lng": 2.3380},
    {"id": "C0104", "name": "UGC Odéon", "area": "6e", "brand": "ugc", "lat": 48.8495, "lng": 2.3390},
    {"id": "C0105", "name": "UGC Rotonde", "area": "6e", "brand": "ugc", "lat": 48.8425, "lng": 2.3265},
    {"id": "C0103", "name": "UGC Montparnasse", "area": "6e", "brand": "ugc", "lat": 48.8430, "lng": 2.3240},
    {"id": "C0146", "name": "UGC Lyon Bastille", "area": "12e", "brand": "ugc", "lat": 48.8485, "lng": 2.3700},
    {"id": "C0026", "name": "UGC Ciné Cité Bercy", "area": "12e", "brand": "ugc", "lat": 48.8305, "lng": 2.3855},
    {"id": "C0150", "name": "UGC Gobelins", "area": "13e", "brand": "ugc", "lat": 48.8330, "lng": 2.3530},
    {"id": "C0175", "name": "UGC Ciné Cité Maillot", "area": "17e", "brand": "ugc", "lat": 48.8785, "lng": 2.2830},
    {"id": "W7509", "name": "UGC Ciné Cité Paris 19", "area": "19e", "brand": "ugc", "lat": 48.8920, "lng": 2.3830},
    # --- MK2 ---
    {"id": "C0050", "name": "MK2 Beaubourg", "area": "3e", "brand": "mk2", "lat": 48.8605, "lng": 2.3520},
    {"id": "C0092", "name": "MK2 Odéon (St-Michel)", "area": "6e", "brand": "mk2", "lat": 48.8530, "lng": 2.3435},
    {"id": "C0097", "name": "MK2 Odéon (St-Germain)", "area": "6e", "brand": "mk2", "lat": 48.8525, "lng": 2.3375},
    {"id": "C0099", "name": "MK2 Parnasse", "area": "6e", "brand": "mk2", "lat": 48.8420, "lng": 2.3275},
    {"id": "C0144", "name": "MK2 Nation", "area": "12e", "brand": "mk2", "lat": 48.8480, "lng": 2.3960},
    {"id": "C2954", "name": "MK2 Bibliothèque", "area": "13e", "brand": "mk2", "lat": 48.8335, "lng": 2.3765},
    {"id": "C0003", "name": "MK2 Quai de Seine", "area": "19e", "brand": "mk2", "lat": 48.8935, "lng": 2.3755},
    {"id": "C1621", "name": "MK2 Quai de Loire", "area": "19e", "brand": "mk2", "lat": 48.8945, "lng": 2.3765},
    {"id": "C0192", "name": "MK2 Gambetta", "area": "20e", "brand": "mk2", "lat": 48.8645, "lng": 2.3985},
    # --- Dulac ---
    {"id": "C0074", "name": "Reflet Médicis", "area": "5e", "brand": "dulac", "lat": 48.8475, "lng": 2.3420},
    {"id": "C0147", "name": "L'Escurial", "area": "13e", "brand": "dulac", "lat": 48.8285, "lng": 2.3475},
    {"id": "C0139", "name": "Majestic Bastille", "area": "11e", "brand": "dulac", "lat": 48.8535, "lng": 2.3705},
    {"id": "C0054", "name": "L'Arlequin", "area": "6e", "brand": "dulac", "lat": 48.8495, "lng": 2.3285},
    {"id": "C0120", "name": "Majestic Passy", "area": "16e", "brand": "dulac", "lat": 48.8575, "lng": 2.2765},
    # --- Autres partenaires ---
    {"id": "C0013", "name": "Luminor Hôtel de Ville", "area": "4e", "brand": "indie", "lat": 48.8565, "lng": 2.3545},
    {"id": "C0073", "name": "Le Champo", "area": "5e", "brand": "indie", "lat": 48.8495, "lng": 2.3435},
    {"id": "C0076", "name": "Cinéma du Panthéon", "area": "5e", "brand": "indie", "lat": 48.8465, "lng": 2.3430},
    {"id": "C0020", "name": "Filmothèque du Quartier Latin", "area": "5e", "brand": "indie", "lat": 48.8490, "lng": 2.3450},
    {"id": "C0071", "name": "Écoles Cinéma Club", "area": "5e", "brand": "indie", "lat": 48.8485, "lng": 2.3480},
    {"id": "C0072", "name": "Le Grand Action", "area": "5e", "brand": "indie", "lat": 48.8470, "lng": 2.3505},
    {"id": "C0083", "name": "Studio des Ursulines", "area": "5e", "brand": "indie", "lat": 48.8415, "lng": 2.3485},
    {"id": "C0016", "name": "Studio Galande", "area": "5e", "brand": "indie", "lat": 48.8525, "lng": 2.3475},
    {"id": "W7504", "name": "L'Épée de Bois", "area": "5e", "brand": "indie", "lat": 48.8410, "lng": 2.3510},
    {"id": "C0015", "name": "Christine Cinéma Club", "area": "6e", "brand": "indie", "lat": 48.8530, "lng": 2.3370},
    {"id": "C0095", "name": "Les 3 Luxembourg", "area": "6e", "brand": "indie", "lat": 48.8480, "lng": 2.3380},
    {"id": "C0093", "name": "Lucernaire", "area": "6e", "brand": "indie", "lat": 48.8435, "lng": 2.3290},
    {"id": "C0041", "name": "Nouvel Odéon", "area": "6e", "brand": "indie", "lat": 48.8505, "lng": 2.3385},
    {"id": "C0100", "name": "Saint-André des Arts", "area": "6e", "brand": "indie", "lat": 48.8535, "lng": 2.3430},
    {"id": "C0009", "name": "Le Balzac", "area": "8e", "brand": "indie", "lat": 48.8715, "lng": 2.3005},
    {"id": "C0108", "name": "Le Lincoln", "area": "8e", "brand": "indie", "lat": 48.8705, "lng": 2.3035},
    {"id": "C6336", "name": "Publicis Cinémas", "area": "8e", "brand": "indie", "lat": 48.8695, "lng": 2.3075},
    {"id": "C0012", "name": "Les Cinq Caumartin", "area": "9e", "brand": "indie", "lat": 48.8725, "lng": 2.3295},
    {"id": "C0089", "name": "Max Linder Panorama", "area": "9e", "brand": "indie", "lat": 48.8710, "lng": 2.3435},
    {"id": "C0023", "name": "Le Brady", "area": "10e", "brand": "indie", "lat": 48.8705, "lng": 2.3575},
    {"id": "W7510", "name": "Le Louxor", "area": "10e", "brand": "indie", "lat": 48.8835, "lng": 2.3495},
    {"id": "C0025", "name": "Les 7 Parnassiens", "area": "14e", "brand": "indie", "lat": 48.8410, "lng": 2.3295},
    {"id": "C0061", "name": "Studio 28", "area": "18e", "brand": "indie", "lat": 48.8855, "lng": 2.3355},
]

BRANDS = [
    {"id": "all", "label": "All", "icon": "/static/assets/all.svg"},
    {"id": "ugc", "label": "UGC", "icon": "/static/assets/ugc.png"},
    {"id": "mk2", "label": "mk2", "icon": "/static/assets/mk2.png"},
    {"id": "dulac", "label": "Dulac Cinémas", "icon": "/static/assets/dulac.png"},
]


def theaters_for_brand(brand: str | None = None) -> list[dict]:
    if not brand or brand.strip().lower() == "all":
        return list(THEATERS)
    brand = brand.strip().lower()
    return [t for t in THEATERS if t["brand"] == brand]


def get_theater(theater_id: str) -> dict | None:
    theater_id = theater_id.strip().upper()
    for theater in THEATERS:
        if theater["id"] == theater_id:
            return theater
    return None
