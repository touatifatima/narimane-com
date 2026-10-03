const db = require('../db');

// Default starting fee in DZD. Adjust individual fees from the admin dashboard.
const wilayas = [
  'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra',
  'Béchar', 'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret',
  'Tizi Ouzou', 'Alger', 'Djelfa', 'Jijel', 'Sétif', 'Saïda', 'Skikda',
  'Sidi Bel Abbès', 'Annaba', 'Guelma', 'Constantine', 'Médéa', 'Mostaganem',
  'M’Sila', 'Mascara', 'Ouargla', 'Oran', 'El Bayadh', 'Illizi', 'Bordj Bou Arréridj',
  'Boumerdès', 'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued', 'Khenchela',
  'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent',
  'Ghardaïa', 'Relizane', 'Timimoun', 'Bordj Badji Mokhtar', 'Ouled Djellal',
  'Béni Abbès', 'In Salah', 'In Guezzam', 'Touggourt', 'Djanet', 'El M’Ghair',
  'El Meniaa', 'Aflou', 'Barika', 'El Kantara', 'Bir El Ater', 'El Aricha',
  'Ksar Chellala', 'Aïn Oussara', 'Messaad', 'Ksar El Boukhari', 'Boussaada',
  'El Abiodh Sidi Cheikh',
];

async function main() {
  for (const [index, wilaya_name] of wilayas.entries()) {
    const wilaya_code = String(index + 1).padStart(2, '0');
    await db.delivery_rates.upsert({
      where: { wilaya_code },
      create: { wilaya_code, wilaya_name, fee: '600', is_active: true },
      update: { wilaya_name, is_active: true },
    });
  }
  console.log(`Seeded ${wilayas.length} delivery rates.`);
}

main().catch(error => {
  console.error('Could not seed delivery rates:', error.message);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
