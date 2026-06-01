/**
 * seedKnowledge.ts
 * Seeds foundational Indonesian legal data into Neo4j.
 * Safe to re-run: uses MERGE to avoid duplicates.
 *
 * Usage: npm run seed
 */
import { getDriver, closeDriver } from "../config/neo4j";

async function seedKnowledge(): Promise<void> {
  const session = getDriver().session();
  try {
    console.log("🌱 Seeding legal knowledge graph …");

    // Laws 
    await session.run(`
      MERGE (l1:Law { id: 'UU-13-2003' })
        SET l1.title = 'Undang-Undang No. 13 Tahun 2003 tentang Ketenagakerjaan',
            l1.year = 2003
      MERGE (l2:Law { id: 'UU-11-2020' })
        SET l2.title = 'Undang-Undang No. 11 Tahun 2020 tentang Cipta Kerja',
            l2.year = 2020
      MERGE (l3:Law { id: 'KUHPerdata' })
        SET l3.title = 'Kitab Undang-Undang Hukum Perdata (KUHPerdata)',
            l3.year = 1847
      MERGE (l4:Law { id: 'UUD-1945' })
        SET l4.title = 'Undang-Undang Dasar Negara Republik Indonesia Tahun 1945',
            l4.year = 1945

      // UU Cipta Kerja amends UU Ketenagakerjaan
      MERGE (l2)-[:AMENDS]->(l1)
    `);
    console.log("  ✔ Laws seeded");

    // Core Articles 
    await session.run(`
      MATCH (uk:Law { id: 'UU-13-2003' })
      MATCH (uck:Law { id: 'UU-11-2020' })
      MATCH (kuh:Law { id: 'KUHPerdata' })

      // PKWT limit
      MERGE (a:Article { id: 'UU13-59' })
        SET a.number = 'Pasal 59',
            a.title = 'Perjanjian Kerja Waktu Tertentu (PKWT)',
            a.content = 'Perjanjian kerja untuk waktu tertentu maksimal 2 tahun dan dapat diperpanjang 1 tahun.',
            a.max_pkwt_years = 2,
            a.law_id = 'UU-13-2003'
      MERGE (a)-[:PART_OF]->(uk)

      // Severance
      MERGE (b:Article { id: 'UU13-156' })
        SET b.number = 'Pasal 156',
            b.title = 'Uang Pesangon',
            b.content = 'Pengusaha wajib membayar uang pesangon dan/atau uang penghargaan masa kerja dan uang penggantian hak sesuai ketentuan.',
            b.law_id = 'UU-13-2003'
      MERGE (b)-[:PART_OF]->(uk)

      // Minimum wage
      MERGE (c:Article { id: 'UU13-90' })
        SET c.number = 'Pasal 90',
            c.title = 'Upah Minimum',
            c.content = 'Pengusaha dilarang membayar upah lebih rendah dari upah minimum yang ditetapkan pemerintah.',
            c.law_id = 'UU-13-2003'
      MERGE (c)-[:PART_OF]->(uk)

      // KUHPerdata – Wanprestasi
      MERGE (d:Article { id: 'KUH-1243' })
        SET d.number = 'Pasal 1243',
            d.title = 'Ganti Rugi karena Wanprestasi',
            d.content = 'Penggantian biaya, rugi, dan bunga karena tidak dipenuhinya suatu perikatan, barulah mulai diwajibkan apabila debitur, setelah dinyatakan lalai.',
            d.law_id = 'KUHPerdata'
      MERGE (d)-[:PART_OF]->(kuh)

      // KUHPerdata – Syarat Sah Kontrak
      MERGE (e:Article { id: 'KUH-1320' })
        SET e.number = 'Pasal 1320',
            e.title = 'Syarat Sah Perjanjian',
            e.content = 'Syarat sahnya perjanjian: sepakat, kecakapan, hal tertentu, sebab yang halal.',
            e.law_id = 'KUHPerdata'
      MERGE (e)-[:PART_OF]->(kuh)

      // KUHPerdata – Unilateral termination
      MERGE (f:Article { id: 'KUH-1266' })
        SET f.number = 'Pasal 1266',
            f.title = 'Pembatalan Perjanjian',
            f.content = 'Syarat batal dianggap selalu dicantumkan dalam persetujuan-persetujuan yang bertimbal balik. Apabila salah satu pihak tidak memenuhi kewajibannya, persetujuan tidak batal dengan sendirinya; pihak lain harus meminta pembatalan lewat pengadilan.',
            f.law_id = 'KUHPerdata'
      MERGE (f)-[:PART_OF]->(kuh)

      // KUHPerdata – Liquidated damages
      MERGE (g:Article { id: 'KUH-1267' })
        SET g.number = 'Pasal 1267',
            g.title = 'Hak Pihak yang Dirugikan',
            g.content = 'Pihak yang tidak dipenuhi perikatannya boleh memilih antara memaksa pihak lain memenuhi perjanjian atau menuntut pembatalan persetujuan beserta penggantian biaya, kerugian, dan bunga.',
            g.law_id = 'KUHPerdata'
      MERGE (g)-[:PART_OF]->(kuh)
    `);
    console.log("  ✔ Articles seeded");

    // Legal Concepts 
    await session.run(`
      MERGE (c1:LegalConcept { name: 'Wanprestasi' })
        SET c1.description = 'Kegagalan salah satu pihak untuk memenuhi kewajiban dalam perjanjian tanpa alasan yang sah.',
            c1.content = 'Wanprestasi terjadi ketika debitur tidak melaksanakan prestasinya sesuai isi perjanjian. Akibatnya, kreditur berhak menuntut ganti rugi berdasarkan Pasal 1243 KUHPerdata.',
            c1.related_articles = ['KUH-1243', 'KUH-1266', 'KUH-1267']

      MERGE (c2:LegalConcept { name: 'PHK' })
        SET c2.description = 'Pemutusan Hubungan Kerja – pengakhiran hubungan kerja antara pengusaha dan pekerja.',
            c2.content = 'PHK diatur dalam UU Ketenagakerjaan. Pengusaha wajib membayar pesangon, uang penghargaan masa kerja, dan penggantian hak sesuai Pasal 156.',
            c2.related_articles = ['UU13-156']

      MERGE (c3:LegalConcept { name: 'PKWT' })
        SET c3.description = 'Perjanjian Kerja Waktu Tertentu – kontrak kerja dengan jangka waktu terbatas.',
            c3.content = 'PKWT berlaku maksimal 2 tahun dan dapat diperpanjang 1 tahun (Pasal 59 UU-13/2003). PKWT tidak boleh mensyaratkan masa percobaan.',
            c3.max_duration_years = 2,
            c3.related_articles = ['UU13-59']

      MERGE (c4:LegalConcept { name: 'Force Majeure' })
        SET c4.description = 'Keadaan memaksa – peristiwa di luar kendali para pihak yang menghalangi pemenuhan perjanjian.',
            c4.content = 'Force majeure merupakan alasan pembenar tidak dipenuhinya prestasi. Klausula force majeure yang adil mencakup: bencana alam, perang, pandemi, tindakan pemerintah. Harus ada notifikasi dalam batas waktu tertentu.',
            c4.related_articles = ['KUH-1244', 'KUH-1245']

      MERGE (c5:LegalConcept { name: 'Penyitaan' })
        SET c5.description = 'Klausula penyitaan paksa – klausula yang membolehkan kreditur menyita aset tanpa putusan pengadilan.',
            c5.content = 'Klausula penyitaan paksa bertentangan dengan putusan Mahkamah Konstitusi. MK menyatakan bahwa penyitaan hanya dapat dilakukan atas dasar putusan pengadilan yang berkekuatan hukum tetap.',
            c5.severity = 'CRITICAL',
            c5.mk_ruling = 'MK/18/PUU-XVII/2019',
            c5.related_articles = []

      MERGE (c6:LegalConcept { name: 'Denda' })
        SET c6.description = 'Klausula denda/penalti dalam perjanjian.',
            c6.content = 'Denda keterlambatan dan penalti kontrak yang wajar umumnya di bawah 5% per bulan. Denda di atas batas wajar dapat dianggap perjanjian riba dan bertentangan dengan OJK.',
            c6.max_penalty_percent_per_month = 5.0,
            c6.related_articles = ['KUH-1243', 'KUH-1267']

      MERGE (c7:LegalConcept { name: 'Bunga' })
        SET c7.description = 'Klausula bunga dalam perjanjian hutang-piutang.',
            c7.content = 'Bunga pinjaman yang wajar sesuai regulasi OJK maksimal 2% per bulan untuk pinjaman non-bank. Bunga di atas 2% per bulan berpotensi dikualifikasikan sebagai riba.',
            c7.max_interest_percent_per_month = 2.0,
            c7.related_articles = ['KUH-1320']
    `);
    console.log("  ✔ Legal concepts seeded");

    // Clause Templates (for Smart Drafter) 
    await session.run(`
      MERGE (t1:ClauseTemplate { id: 'mou-parties' })
        SET t1.document_type = 'MoU',
            t1.title = 'PARA PIHAK',
            t1.order = 1,
            t1.template = 'Perjanjian ini dibuat oleh dan antara:\\n\\n1. **{{party_a_name}}**, bertempat kedudukan di {{party_a_address}}, selanjutnya disebut sebagai "PIHAK PERTAMA"\\n\\n2. **{{party_b_name}}**, bertempat kedudukan di {{party_b_address}}, selanjutnya disebut sebagai "PIHAK KEDUA"'

      MERGE (t2:ClauseTemplate { id: 'mou-recitals' })
        SET t2.document_type = 'MoU',
            t2.title = 'LATAR BELAKANG',
            t2.order = 2,
            t2.template = 'PARA PIHAK dengan ini menyatakan bahwa:\\n\\na. PIHAK PERTAMA adalah {{party_a_description}}\\nb. PIHAK KEDUA adalah {{party_b_description}}\\nc. PARA PIHAK bermaksud untuk menjalin kerja sama dalam bidang {{scope}}'

      MERGE (t3:ClauseTemplate { id: 'mou-scope' })
        SET t3.document_type = 'MoU',
            t3.title = 'RUANG LINGKUP KERJA SAMA',
            t3.order = 3,
            t3.template = 'Ruang lingkup kerja sama meliputi:\\n\\n{{scope_details}}'

      MERGE (t4:ClauseTemplate { id: 'mou-duration' })
        SET t4.document_type = 'MoU',
            t4.title = 'JANGKA WAKTU',
            t4.order = 4,
            t4.template = 'Nota Kesepahaman ini berlaku selama {{duration}} terhitung sejak tanggal penandatanganan dan dapat diperpanjang atas persetujuan PARA PIHAK.'

      MERGE (t5:ClauseTemplate { id: 'mou-confidentiality' })
        SET t5.document_type = 'MoU',
            t5.title = 'KERAHASIAAN',
            t5.order = 5,
            t5.template = 'PARA PIHAK sepakat untuk menjaga kerahasiaan seluruh informasi yang diperoleh dalam rangka pelaksanaan kerja sama ini dan tidak mengungkapkan kepada pihak ketiga tanpa persetujuan tertulis.'

      MERGE (t6:ClauseTemplate { id: 'mou-force-majeure' })
        SET t6.document_type = 'MoU',
            t6.title = 'KEADAAN MEMAKSA (FORCE MAJEURE)',
            t6.order = 6,
            t6.template = 'Apabila terjadi keadaan memaksa yang mengakibatkan PIHAK yang terdampak tidak dapat melaksanakan kewajibannya, maka PIHAK tersebut harus memberitahukan secara tertulis kepada PIHAK lainnya dalam waktu 7 (tujuh) hari kerja sejak terjadinya keadaan memaksa.'

      MERGE (t7:ClauseTemplate { id: 'mou-dispute' })
        SET t7.document_type = 'MoU',
            t7.title = 'PENYELESAIAN PERSELISIHAN',
            t7.order = 7,
            t7.template = 'Segala perselisihan yang timbul dari Nota Kesepahaman ini diselesaikan secara musyawarah mufakat. Apabila tidak tercapai kesepakatan dalam 30 (tiga puluh) hari, PARA PIHAK bersepakat untuk menyelesaikan melalui Pengadilan Negeri {{jurisdiction}} sesuai hukum yang berlaku di Indonesia.'

      MERGE (t8:ClauseTemplate { id: 'loi-declaration' })
        SET t8.document_type = 'LoI',
            t8.title = 'PERNYATAAN NIAT',
            t8.order = 1,
            t8.template = 'Dengan surat ini kami {{party_name}} menyatakan niat dan minat yang serius untuk {{intent_description}} dengan pihak {{counterparty}}.'

      MERGE (t9:ClauseTemplate { id: 'loi-conditions' })
        SET t9.document_type = 'LoI',
            t9.title = 'SYARAT DAN KETENTUAN',
            t9.order = 2,
            t9.template = 'Pernyataan niat ini tunduk pada kondisi-kondisi sebagai berikut:\\n\\n{{conditions}}'

      MERGE (t10:ClauseTemplate { id: 'pks-parties' })
        SET t10.document_type = 'PKS',
            t10.title = 'PARA PIHAK',
            t10.order = 1,
            t10.template = 'Perjanjian Kerja Sama ini dibuat dan ditandatangani oleh:\\n\\n1. **{{party_a_name}}**, diwakili oleh {{party_a_rep}}, jabatan {{party_a_title}}, selanjutnya "PIHAK PERTAMA"\\n\\n2. **{{party_b_name}}**, diwakili oleh {{party_b_rep}}, jabatan {{party_b_title}}, selanjutnya "PIHAK KEDUA"'

      MERGE (t11:ClauseTemplate { id: 'pks-obligations' })
        SET t11.document_type = 'PKS',
            t11.title = 'HAK DAN KEWAJIBAN',
            t11.order = 3,
            t11.template = 'PIHAK PERTAMA berkewajiban untuk:\\n{{party_a_obligations}}\\n\\nPIHAK KEDUA berkewajiban untuk:\\n{{party_b_obligations}}'

      MERGE (t12:ClauseTemplate { id: 'pks-payment' })
        SET t12.document_type = 'PKS',
            t12.title = 'PEMBAYARAN',
            t12.order = 4,
            t12.template = 'PIHAK PERTAMA akan membayar kepada PIHAK KEDUA sejumlah **{{amount}}** dengan mekanisme pembayaran: {{payment_method}}. Pembayaran dilakukan selambat-lambatnya {{payment_deadline}}.'
    `);
    console.log("  ✔ Clause templates seeded (MoU, LoI, PKS)");

    // Relationships between concepts and articles 
    await session.run(`
      MATCH (wan:LegalConcept { name: 'Wanprestasi' }), (a1243:Article { id: 'KUH-1243' })
      MERGE (wan)-[:GOVERNED_BY]->(a1243)

      MATCH (phk:LegalConcept { name: 'PHK' }), (a156:Article { id: 'UU13-156' })
      MERGE (phk)-[:GOVERNED_BY]->(a156)

      MATCH (pkwt:LegalConcept { name: 'PKWT' }), (a59:Article { id: 'UU13-59' })
      MERGE (pkwt)-[:GOVERNED_BY]->(a59)
    `);
    console.log("  ✔ Concept–Article relationships created");

    console.log("✅ Knowledge graph seeding complete.");
  } finally {
    await session.close();
  }
}

if (require.main === module) {
  seedKnowledge()
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    })
    .finally(closeDriver);
}

export { seedKnowledge };
