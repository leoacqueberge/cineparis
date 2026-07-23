"""Cinémas du Pass UGC Illimité à Paris (UGC + partenaires, sans Pathé/Gaumont)."""

from __future__ import annotations

THEATERS = [
    # --- UGC ---
    {"id": "C0159", "name": "UGC Ciné Cité Les Halles", "area": "1er", "brand": "ugc"},
    {"id": "C0126", "name": "UGC Opéra", "area": "9e", "brand": "ugc"},
    {"id": "C0102", "name": "UGC Danton", "area": "6e", "brand": "ugc"},
    {"id": "C0104", "name": "UGC Odéon", "area": "6e", "brand": "ugc"},
    {"id": "C0105", "name": "UGC Rotonde", "area": "6e", "brand": "ugc"},
    {"id": "C0103", "name": "UGC Montparnasse", "area": "6e", "brand": "ugc"},
    {"id": "C0146", "name": "UGC Lyon Bastille", "area": "12e", "brand": "ugc"},
    {"id": "C0026", "name": "UGC Ciné Cité Bercy", "area": "12e", "brand": "ugc"},
    {"id": "C0150", "name": "UGC Gobelins", "area": "13e", "brand": "ugc"},
    {"id": "C0175", "name": "UGC Ciné Cité Maillot", "area": "17e", "brand": "ugc"},
    {"id": "W7509", "name": "UGC Ciné Cité Paris 19", "area": "19e", "brand": "ugc"},
    # --- MK2 ---
    {"id": "C0050", "name": "MK2 Beaubourg", "area": "3e", "brand": "mk2"},
    {"id": "C0092", "name": "MK2 Odéon (St-Michel)", "area": "6e", "brand": "mk2"},
    {"id": "C0097", "name": "MK2 Odéon (St-Germain)", "area": "6e", "brand": "mk2"},
    {"id": "C0099", "name": "MK2 Parnasse", "area": "6e", "brand": "mk2"},
    {"id": "C0144", "name": "MK2 Nation", "area": "12e", "brand": "mk2"},
    {"id": "C2954", "name": "MK2 Bibliothèque", "area": "13e", "brand": "mk2"},
    {"id": "C0003", "name": "MK2 Quai de Seine", "area": "19e", "brand": "mk2"},
    {"id": "C1621", "name": "MK2 Quai de Loire", "area": "19e", "brand": "mk2"},
    {"id": "C0192", "name": "MK2 Gambetta", "area": "20e", "brand": "mk2"},
    # --- Dulac ---
    {"id": "C0074", "name": "Reflet Médicis", "area": "5e", "brand": "dulac"},
    {"id": "C0147", "name": "L'Escurial", "area": "13e", "brand": "dulac"},
    {"id": "C0139", "name": "Majestic Bastille", "area": "11e", "brand": "dulac"},
    {"id": "C0054", "name": "L'Arlequin", "area": "6e", "brand": "dulac"},
    {"id": "C0120", "name": "Majestic Passy", "area": "16e", "brand": "dulac"},
    # --- Autres partenaires ---
    {"id": "C0013", "name": "Luminor Hôtel de Ville", "area": "4e", "brand": "indie"},
    {"id": "C0073", "name": "Le Champo", "area": "5e", "brand": "indie"},
    {"id": "C0076", "name": "Cinéma du Panthéon", "area": "5e", "brand": "indie"},
    {"id": "C0020", "name": "Filmothèque du Quartier Latin", "area": "5e", "brand": "indie"},
    {"id": "C0071", "name": "Écoles Cinéma Club", "area": "5e", "brand": "indie"},
    {"id": "C0072", "name": "Le Grand Action", "area": "5e", "brand": "indie"},
    {"id": "C0083", "name": "Studio des Ursulines", "area": "5e", "brand": "indie"},
    {"id": "C0016", "name": "Studio Galande", "area": "5e", "brand": "indie"},
    {"id": "W7504", "name": "L'Épée de Bois", "area": "5e", "brand": "indie"},
    {"id": "C0015", "name": "Christine Cinéma Club", "area": "6e", "brand": "indie"},
    {"id": "C0095", "name": "Les 3 Luxembourg", "area": "6e", "brand": "indie"},
    {"id": "C0093", "name": "Lucernaire", "area": "6e", "brand": "indie"},
    {"id": "C0041", "name": "Nouvel Odéon", "area": "6e", "brand": "indie"},
    {"id": "C0100", "name": "Saint-André des Arts", "area": "6e", "brand": "indie"},
    {"id": "C0009", "name": "Le Balzac", "area": "8e", "brand": "indie"},
    {"id": "C0108", "name": "Le Lincoln", "area": "8e", "brand": "indie"},
    {"id": "C6336", "name": "Publicis Cinémas", "area": "8e", "brand": "indie"},
    {"id": "C0012", "name": "Les Cinq Caumartin", "area": "9e", "brand": "indie"},
    {"id": "C0089", "name": "Max Linder Panorama", "area": "9e", "brand": "indie"},
    {"id": "C0023", "name": "Le Brady", "area": "10e", "brand": "indie"},
    {"id": "W7510", "name": "Le Louxor", "area": "10e", "brand": "indie"},
    {"id": "C0025", "name": "Les 7 Parnassiens", "area": "14e", "brand": "indie"},
    {"id": "C0061", "name": "Studio 28", "area": "18e", "brand": "indie"},
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
