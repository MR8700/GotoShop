import os
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models import Product, Category, Store, ProductVariant

def populate_rich_catalog():
    db = SessionLocal()
    store = db.query(Store).first()
    if not store:
        print("No store found!")
        return

    cat_wax = db.query(Category).filter(Category.slug == 'robes-ankara').first()
    cat_tech = db.query(Category).filter(Category.slug == 'smartphones-accessoires').first()
    cat_bijoux = db.query(Category).filter(Category.slug == 'bijoux-parfums').first()
    cat_promo = db.query(Category).filter(Category.slug == 'packs-promo').first()

    catalog_items = [
        # Robes & Wax
        {
            'category_id': cat_wax.id,
            'name': 'Robe Sirène Dentelle & Wax "Princesse Yennenga"',
            'slug': 'robe-sirene-dentelle-wax-yennenga',
            'description': 'Sublime robe coupe sirène confectionnée avec du tissu wax véritable et incrustations de dentelle fine. Idéale pour cérémonies, mariages et soirées de gala.',
            'short_description': 'Coupe sirène, dentelle fine et tissu wax véritable pour cérémonies.',
            'price': 28000,
            'old_price': 34000,
            'stock': 6,
            'stock_label': 'Reste 6 en stock',
            'badge_tag': 'Nouveauté Chic',
            'active_discussions_count': 14,
            'views_count': 285,
            'sales_count': 7,
            'revenue': 196000,
            'guarantee_text': 'Finitions Coutures Soignées',
            'primary_image_url': '/media/products/robe_ankara_reine_sika.jpg',
            'display_order': 4
        },
        {
            'category_id': cat_wax.id,
            'name': 'Chemise Homme Lin & Wax "Dandy d\'Abidjan"',
            'slug': 'chemise-homme-lin-wax-dandy',
            'description': 'Chemise moderne pour homme combinant lin blanc respirant de qualité supérieure et détails raffinés en pagne wax aux cols et poignets.',
            'short_description': 'Lin blanc respirant et détails wax aux cols et poignets.',
            'price': 18500,
            'old_price': 22000,
            'stock': 8,
            'stock_label': 'En stock',
            'badge_tag': 'Collection Homme',
            'active_discussions_count': 9,
            'views_count': 190,
            'sales_count': 5,
            'revenue': 92500,
            'guarantee_text': '100% Coton & Lin',
            'primary_image_url': '/media/products/tailleur_veste_babi_boss.jpg',
            'display_order': 5
        },
        {
            'category_id': cat_wax.id,
            'name': 'Kaftan Soie & Broderie Royale "Lumière du Faso"',
            'slug': 'kaftan-soie-broderie-royale',
            'description': 'Kaftan ample d\'inspiration sahélienne en mousseline de soie doublée avec broderies dorées faites à la main par des maîtres artisans.',
            'short_description': 'Mousseline de soie et broderies dorées cousues main.',
            'price': 35000,
            'old_price': 42000,
            'stock': 5,
            'stock_label': 'Plus que 5',
            'badge_tag': 'Haute Couture',
            'active_discussions_count': 16,
            'views_count': 320,
            'sales_count': 11,
            'revenue': 385000,
            'guarantee_text': 'Broderie Artisanale',
            'primary_image_url': '/media/products/pagne_wax_authentique.jpg',
            'display_order': 6
        },
        # Tech & Accessoires
        {
            'category_id': cat_tech.id,
            'name': 'PowerBank Solaire Ultra-Rapide 30 000mAh',
            'slug': 'powerbank-solaire-30000mah',
            'description': 'Batterie externe haute capacité avec panneau solaire d\'appoint intégré, double sortie USB-C Power Delivery 22.5W et lampe torche LED puissante.',
            'short_description': '30 000mAh, recharge solaire intégrée, USB-C 22.5W.',
            'price': 22000,
            'old_price': 27000,
            'stock': 9,
            'stock_label': 'En stock',
            'badge_tag': 'Autonomie XXL',
            'active_discussions_count': 22,
            'views_count': 410,
            'sales_count': 18,
            'revenue': 396000,
            'guarantee_text': 'Garantie 6 Mois',
            'primary_image_url': '/media/products/samsung_galaxy_a15_thumb.jpg',
            'display_order': 8
        },
        {
            'category_id': cat_tech.id,
            'name': 'Chargeur Sans Fil Rapide MagSafe 15W',
            'slug': 'chargeur-sans-fil-magsafe-15w',
            'description': 'Station de charge par induction ultra-fine avec alignement magnétique précis pour tous smartphones compatibles Qi. Protection anti-surchauffe.',
            'short_description': 'Charge magnétique rapide 15W sans fil ultra-fine.',
            'price': 12500,
            'old_price': 16000,
            'stock': 15,
            'stock_label': 'En stock',
            'badge_tag': 'Charge Express',
            'active_discussions_count': 7,
            'views_count': 150,
            'sales_count': 10,
            'revenue': 125000,
            'guarantee_text': 'Norme CE / Qi',
            'primary_image_url': '/media/products/casque_bluetooth_pro.jpg',
            'display_order': 9
        },
        # Bijoux & Parfums
        {
            'category_id': cat_bijoux.id,
            'name': 'Collier Chaîne Or 18k & Pendentif Carte d\'Afrique',
            'slug': 'collier-chaine-or-carte-afrique',
            'description': 'Collier de prestige en plaqué or 18 carats garanti 2 ans avec pendentif ciselé représentant le continent africain orné d\'un zircon brillant.',
            'short_description': 'Plaqué Or 18 carats avec pendentif continent ciselé.',
            'price': 42000,
            'old_price': 50000,
            'stock': 6,
            'stock_label': 'Plus que 6',
            'badge_tag': 'Or Certifié 18k',
            'active_discussions_count': 25,
            'views_count': 395,
            'sales_count': 14,
            'revenue': 588000,
            'guarantee_text': 'Garantie 24 Mois',
            'primary_image_url': '/media/products/coffret_parure_ecouteurs.jpg',
            'display_order': 3
        },
        {
            'category_id': cat_bijoux.id,
            'name': 'Bracelet Jonc Perles de Rocaille & Argent Massif',
            'slug': 'bracelet-jonc-perles-argent',
            'description': 'Bracelet jonc ouvert ajustable combinant l\'argent massif 925 et le tissage traditionnel de micro-perles de rocaille aux couleurs royales.',
            'short_description': 'Argent massif 925 et tissage de perles artisanales.',
            'price': 19500,
            'old_price': 24000,
            'stock': 10,
            'stock_label': 'En stock',
            'badge_tag': 'Fait Main',
            'active_discussions_count': 8,
            'views_count': 180,
            'sales_count': 6,
            'revenue': 117000,
            'guarantee_text': 'Argent Véritable',
            'primary_image_url': '/media/products/coffret_parure_ecouteurs.jpg',
            'display_order': 4
        },
        {
            'category_id': cat_bijoux.id,
            'name': 'Parfum Privé "Oud Royal & Rose Noire"',
            'slug': 'parfum-prive-oud-royal',
            'description': 'Extrait de parfum concentré 100ml unisexe aux accords profonds de bois d\'agar cambodgien, rose de Damas et cuir ambré. Sillage remarquable.',
            'short_description': 'Extrait de parfum concentré 100ml Oud rare & rose noire.',
            'price': 45000,
            'old_price': 55000,
            'stock': 5,
            'stock_label': 'Plus que 5',
            'badge_tag': 'Sillage Intense',
            'active_discussions_count': 19,
            'views_count': 340,
            'sales_count': 12,
            'revenue': 540000,
            'guarantee_text': 'Extrait Concentré',
            'primary_image_url': '/media/products/coffret_parure_ecouteurs.jpg',
            'display_order': 5
        },
        # Packs Promo
        {
            'category_id': cat_promo.id,
            'name': 'Pack Nomade Connecté : Montre S3 + Écouteurs Pro TWS',
            'slug': 'pack-nomade-montre-ecouteurs',
            'description': 'Le duo connecté parfait pour votre quotidien actif et vos séances de sport. Bénéficiez de 15% de remise immédiate sur l\'achat groupé.',
            'short_description': 'Montre connectée S3 + Écouteurs Pro TWS en pack remisé.',
            'price': 52000,
            'old_price': 60000,
            'stock': 7,
            'stock_label': 'Pack Économique',
            'badge_tag': '-15% Économie',
            'active_discussions_count': 31,
            'views_count': 490,
            'sales_count': 16,
            'revenue': 832000,
            'guarantee_text': 'Garantie Intégrale',
            'primary_image_url': '/media/products/montre_connectee_s3.jpg',
            'display_order': 2
        },
        {
            'category_id': cat_promo.id,
            'name': 'Coffret Vénus : Robe Reine Sika + Bague Or Blanc',
            'slug': 'coffret-venus-robe-bague',
            'description': 'Offrez-vous l\'accord parfait entre l\'élégance de la robe Ankara évasée et la pureté éclatante de la bague saphir en or blanc 18k.',
            'short_description': 'Robe Ankara Reine Sika + Bague Saphir Or Blanc en coffret prestige.',
            'price': 80000,
            'old_price': 90000,
            'stock': 4,
            'stock_label': 'Édition Prestige',
            'badge_tag': 'Pack Féminin VIP',
            'active_discussions_count': 18,
            'views_count': 310,
            'sales_count': 8,
            'revenue': 640000,
            'guarantee_text': 'Coffret Luxe Offert',
            'primary_image_url': '/media/products/robe_ankara_reine_sika.jpg',
            'display_order': 3
        }
    ]

    added = 0
    for item in catalog_items:
        existing = db.query(Product).filter(Product.slug == item['slug']).first()
        if not existing:
            p = Product(
                store_id=store.id,
                category_id=item['category_id'],
                name=item['name'],
                slug=item['slug'],
                description=item['description'],
                short_description=item['short_description'],
                price=item['price'],
                old_price=item['old_price'],
                currency='FCFA',
                stock=item['stock'],
                stock_label=item['stock_label'],
                is_hero_deal=False,
                badge_tag=item['badge_tag'],
                active_discussions_count=item['active_discussions_count'],
                views_count=item['views_count'],
                sales_count=item['sales_count'],
                revenue=item['revenue'],
                guarantee_text=item['guarantee_text'],
                primary_image_url=item['primary_image_url'],
                is_published=True,
                display_order=item['display_order']
            )
            db.add(p)
            added += 1

    db.commit()
    print(f"Added {added} products to the catalog.")

    for c in db.query(Category).all():
        count = db.query(Product).filter(Product.category_id == c.id, Product.is_published == True).count()
        print(f"Category: {c.name} ({c.slug}) -> {count} products")

    total = db.query(Product).filter(Product.is_published == True).count()
    print(f"Total Published Products: {total}")

if __name__ == "__main__":
    populate_rich_catalog()
