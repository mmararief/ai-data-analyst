# BAB IV

# HASIL DAN PEMBAHASAN

Bab ini menyajikan hasil implementasi dari perancangan platform AnalisAI yang telah dibahas pada Bab III, diikuti oleh hasil pengujian dan pembahasan secara mendalam. Hasil dan pembahasan diselaraskan secara runut dengan tujuan penelitian, yang mencakup implementasi sistem, hasil pengujian fungsionalitas (*Black-Box Testing*), pengujian keamanan *Docker sandbox*, evaluasi kualitas jawaban AI oleh para ahli, serta hasil pengujian penerimaan pengguna (*User Acceptance Testing* - UAT).

---

## 4.1 Hasil Implementasi Sistem (AnalisAI)

Implementasi platform AnalisAI menghasilkan sistem AI Data Analyst berbasis web fungsional yang memungkinkan otomatisasi eksplorasi, visualisasi, dan pemrosesan data tabular melalui antarmuka percakapan berbahasa alami. Arsitektur sistem diwujudkan sesuai dengan rancangan hibrida (MySQL, Redis, MinIO) dan diorkestrasi menggunakan kontainer Docker.

### 4.1.1 Implementasi Antarmuka Pengguna (Frontend)

Antarmuka pengguna dibangun menggunakan React 19, Vite 7, dan Tailwind CSS 4 dengan gaya estetika modern (sleek dark mode dan elemen semi-transparan/glassmorphism). Antarmuka utama terbagi menjadi tiga halaman fungsional. Halaman pertama adalah *HomePage* yang berfungsi sebagai pintu masuk pengguna untuk memahami cara kerja sistem, sebagaimana diilustrasikan pada Gambar 4.1.

**[Gambar 4.1: Tampilan Halaman Beranda (HomePage) AnalisAI]**

Halaman Beranda menyajikan deskripsi platform, demo pipa pemrosesan data secara visual, serta tombol akses masuk (*login*) atau registrasi akun. Setelah masuk secara sah menggunakan autentikasi JWT, pengguna diarahkan ke *DashboardPage* yang diilustrasikan pada Gambar 4.2.

**[Gambar 4.2: Tampilan Halaman Manajemen Proyek (DashboardPage) AnalisAI]**

*DashboardPage* berfungsi sebagai pusat kendali proyek. Halaman ini menyediakan bilah samping (*sidebar*) yang memuat daftar proyek analitik pengguna, tombol pembuatan proyek baru, serta panel manajemen untuk mengunggah dataset tabular (format CSV, Excel, JSON, Parquet) dan melihat pratinjau data mentah menggunakan pustaka AG Grid. Ketika salah satu proyek dipilih, pengguna masuk ke *ChatPage* untuk memulai percakapan analisis data, sebagaimana ditunjukkan pada Gambar 4.3.

**[Gambar 4.3: Tampilan Antarmuka Percakapan Analisis (ChatPage) AnalisAI]**

*ChatPage* merupakan antarmuka interaktif utama yang terbagi menjadi beberapa komponen visual:
1. **ChatComposer**: Area masukan teks bagi pengguna untuk mengetikkan pertanyaan analisis dalam bahasa alami.
2. **TaskWidget**: Panel daftar rencana kerja dan status pengerjaan yang diperbarui secara *real-time* oleh agen melalui `update_task_list_tool`.
3. **ComputerPanel & PartRenderer**: Panel yang menampilkan riwayat kode Python yang ditulis agen secara otonom, output konsol (*stdout/stderr*), dan grafik hasil rendering Matplotlib/Seaborn.
4. **DashboardViewer**: Panel interaktif khusus untuk merender bagan visual (Chart.js) dan tabel data (AG Grid) ketika agen menghasilkan visualisasi dasbor analitik berbasis DuckDB SQL.

### 4.1.2 Implementasi Sisi Server (Backend & Worker)

Sisi server platform AnalisAI dibangun menggunakan FastAPI sebagai gerbang REST API dan penyedia saluran *streaming* SSE (*Server-Sent Events*). Komunikasi asinkron diimplementasikan melalui arsitektur antrean Redis:
1. FastAPI menerima perintah analisis dari klien, membuat *background job*, mendorongnya ke antrean Redis `queue:jobs`, lalu mengembalikan `job_id` ke klien.
2. Klien segera membuka koneksi streaming SSE ke FastAPI pada rute `/chat/events/{job_id}`.
3. Layanan *Worker* (proses *background* terpisah) menarik pekerjaan dari Redis, memuat agen ReAct LangGraph, dan mulai memproses data secara bertahap.
4. Setiap token teks hasil generasi LLM, status progres, kode yang dijalankan, maupun visualisasi grafik dikirimkan oleh *Worker* ke Redis List (`job:{job_id}:events`) yang secara otomatis di-*broadcast* oleh FastAPI ke klien melalui SSE stream secara *real-time*.

### 4.1.3 Implementasi Docker Sandbox

Eksekusi kode Python yang dibuat oleh agen LLM dilakukan di dalam kontainer Docker terisolasi yang dibuat secara dinamis menggunakan Docker SDK untuk Python. Kontainer dibangun dari *base image* `python:3.10-slim` yang diprapasang dengan dependensi ilmu data. 

Komunikasi IPC antara *Worker* (di host) dan *Sandbox Kernel* (di kontainer) diwujudkan tanpa akses jaringan sama sekali (`network_disabled=True`). Sebagai gantinya, digunakan folder bersama (*shared volume mount*). *Worker* menulis kode ke berkas `_req.json`, kontainer membacanya secara lokal, mengeksekusi kode menggunakan fungsi `exec()` dengan konteks global persisten, lalu menulis kembali output konsol, kesalahan (*traceback*), atau nama berkas grafik yang dihasilkan ke `_res.json`. Setelah selesai, kontainer akan melakukan pembersihan lingkungan secara otomatis.

### 4.1.4 Skenario Simulasi Analisis Data dan Jejak Eksekusi Agen

Untuk memberikan gambaran transparan mengenai proses pengambilan keputusan (*reasoning*) dan tindakan (*acting*) otonom yang dilakukan oleh agen ReAct, dipaparkan dua simulasi kasus analisis nyata menggunakan dataset pengujian.

**Skenario 1: Pencarian Korelasi dan Pembuatan Visualisasi (Dataset Used Car Ford)**

Pada skenario pertama, pengguna mengajukan pertanyaan: *"Cari korelasi antara kapasitas mesin (engineSize) dan harga (price) mobil bekas Ford, lalu visualisasikan dalam scatter plot."*

Siklus penalaran dan eksekusi alat (*tool*) oleh agen ReAct berlangsung sebagai berikut:
1. **Langkah 1 (Penalaran & Tindakan)**: Agen mengidentifikasi perlunya memahami struktur dataset `used_car_ford.csv` terlebih dahulu sebelum melakukan komputasi manipulasi data.
   - *Thought*: "Saya perlu membaca struktur dataset `used_car_ford.csv` untuk memastikan nama kolom kapasitas mesin dan harga yang tepat sebelum menulis kode analisis."
   - *Action*: Memanggil alat `read_data_tool(filename='used_car_ford.csv', n_rows=5)`.
2. **Langkah 1 (Pengamatan)**: Panggilan alat mengembalikan informasi metadata berupa 9 kolom (`model`, `year`, `price`, `transmission`, `mileage`, `fuelType`, `tax`, `mpg`, `engineSize`) dan pratinjau data tabular.
   - *Observation*: Kolom `engineSize` bertipe data numerik desimal (*float*) dan `price` bertipe numerik bulat (*integer*). Nama kolom valid dan siap dianalisis.
3. **Langkah 2 (Penalaran & Tindakan)**: Agen menulis dan mengirimkan kode komputasi untuk menghitung koefisien korelasi Pearson.
   - *Thought*: "Saya akan menulis kode Python menggunakan pustaka Pandas untuk menghitung nilai korelasi Pearson antara kolom `engineSize` dan `price` di dalam Docker sandbox."
   - *Action*: Memanggil alat `python_repl_tool(code='import pandas as pd\ndf = pd.read_csv("/app/data/used_car_ford.csv")\nprint(df[["engineSize", "price"]].corr(method="pearson"))')`.
4. **Langkah 2 (Pengamatan)**: Sandbox mengeksekusi kode secara terisolasi dan mengembalikan output teks konsol (*stdout*).
   - *Observation*: Konsol menampilkan nilai korelasi Pearson antara `engineSize` dan `price` sebesar 0.86 (menunjukkan hubungan positif yang sangat kuat).
5. **Langkah 3 (Penalaran & Tindakan)**: Agen membuat visualisasi grafik untuk mendukung analisis numerik.
   - *Thought*: "Sekarang saya akan membuat visualisasi scatter plot untuk menunjukkan hubungan korelasi ini menggunakan Matplotlib dan Seaborn, lalu menyimpannya sebagai file gambar."
   - *Action*: Memanggil alat `render_chart_tool(code='import matplotlib.pyplot as plt\nimport seaborn as sns\nimport pandas as pd\ndf = pd.read_csv("/app/data/used_car_ford.csv")\nplt.figure(figsize=(8, 5))\nsns.scatterplot(data=df, x="engineSize", y="price", alpha=0.5, color="blue")\nplt.title("Korelasi Kapasitas Mesin vs Harga Mobil Ford")\nplt.xlabel("Kapasitas Mesin (L)")\nplt.ylabel("Harga Jual ($)")', filename='korelasi_mesin_harga.png')`.
6. **Langkah 3 (Pengamatan)**: Sandbox merender grafik, menyimpannya sebagai gambar PNG di MinIO, dan mengembalikan status sukses.
   - *Observation*: Grafik berhasil disimpan dengan nama berkas `korelasi_mesin_harga.png`.
7. **Langkah 4 (Penalaran & Tindakan)**: Agen memperbarui To-Do List fungsional untuk mengabarkan kemajuan kepada pengguna.
   - *Thought*: "Semua langkah analisis numerik dan visualisasi telah selesai. Saya akan memperbarui daftar tugas antarmuka dan menulis ringkasan penjelasan."
   - *Action*: Memanggil alat `update_task_list_tool(tasks=["Baca data", "Hitung korelasi", "Render scatter plot"], completed_indices=[0, 1, 2])`.
8. **Langkah 5 (Jawaban Akhir)**: Agen merangkum hasil analisis dengan bahasa alami dalam Bahasa Indonesia yang formal.
   - *Final Response*: "Berdasarkan analisis pada dataset mobil Ford, terdapat hubungan korelasi positif yang sangat kuat (koefisien Pearson sebesar 0.86) antara kapasitas mesin (`engineSize`) dan harga jual mobil (`price`). Hal ini menunjukkan bahwa secara umum, semakin besar kapasitas mesin kendaraan, semakin tinggi pula harga jualnya. Visualisasi sebaran data ini telah saya tampilkan pada grafik scatter plot di bawah."

**Skenario 2: Pembuatan Dashboard Interaktif Berbasis DuckDB SQL (Dataset Retail Sales)**

Pada skenario kedua, pengguna meminta dasbor interaktif: *"Buat dashboard interaktif untuk menganalisis total penjualan bulanan pada dataset retail_sales_dataset.csv."*

Setelah memahami dataset, agen ReAct merancang dasbor dengan menyusun skema JSON khusus yang memanfaatkan mesin kueri SQL DuckDB di sisi frontend. Kode JSON dasbor yang digenerasikan oleh agen menggunakan `file_export_tool` dimuat pada contoh struktur berikut:

```json
{
  "title": "Dashboard Analisis Ritel",
  "description": "Dashboard interaktif untuk memantau tren transaksi ritel bulanan dan demografi pelanggan",
  "dataset_name": "retail_sales_dataset.csv",
  "insights": [
    "Puncak total transaksi bulanan terjadi secara berkala pada masa liburan akhir tahun.",
    "Kategori produk Elektronik menyumbang kontribusi total nominal transaksi terbesar."
  ],
  "metrics": [
    { "label": "Rata-Rata Transaksi", "value": 450, "format": "currency" },
    { "label": "Jumlah Pelanggan Unik", "value": 1000, "format": "number" }
  ],
  "filters": [
    { "id": "Product Category", "label": "Kategori Produk", "type": "select", "options": ["Semua", "Electronics", "Clothing", "Beauty"] }
  ],
  "charts": [
    {
      "id": "tren_penjualan_bulanan",
      "title": "Tren Total Penjualan Bulanan",
      "type": "line",
      "insight": "Visualisasi ini menunjukkan tren total penjualan per bulan berdasarkan kategori produk yang difilter.",
      "mapping": {
        "x": "bulan",
        "y": ["total_amount"]
      },
      "query": "SELECT strftime('%Y-%m', CAST(\"Date\" AS DATE)) as bulan, SUM(\"Total Amount\") as total_amount, \"Product Category\" FROM dataset GROUP BY bulan, \"Product Category\" ORDER BY bulan"
    }
  ]
}
```

Ketika berkas di atas diekspor ke `/app/data/exports/dashboard.json`, frontend React 19 sistem AnalisAI menangkap payload tersebut, kemudian secara instan melakukan langkah-langkah rendering:
1. Memuat berkas dataset `retail_sales_dataset.csv` secara lokal ke dalam memori peramban (*in-browser DuckDB instance*).
2. Mengeksekusi kueri SQL yang didefinisikan dalam properti `"query"` di atas (`SELECT strftime('%Y-%m', CAST("Date" AS DATE)) as bulan, SUM("Total Amount") as total_amount, "Product Category" FROM dataset...`).
3. Menyalurkan data hasil kueri ke pustaka Chart.js untuk merender grafik garis interaktif yang dinamis.
4. Ketika pengguna merubah filter "Kategori Produk" di UI, DuckDB mengeksekusi subquery penyaringan secara instan tanpa perlu membebani komputasi server *host*, sehingga menghasilkan interaksi dasbor dengan latensi nol.

---

## 4.2 Hasil Pengujian Fungsionalitas (Black-Box Testing)

Pengujian fungsionalitas dilakukan menggunakan metode *Black-Box Testing* untuk memverifikasi keselarasan sistem AnalisAI terhadap kebutuhan fungsional yang didefinisikan pada Bab III. Hasil dari 15 kasus pengujian fungsional dirangkum pada Tabel 4.1.

**Tabel 4.1 Hasil Pengujian Fungsional Black-Box Sistem AnalisAI**

| No | Skenario Kasus Uji | Parameter Masukan | Hasil yang Diamati | Status |
|:---:|---|---|---|:---:|
| 1 | Registrasi akun baru | Kredensial pengguna baru | Akun berhasil dibuat dan tersimpan di database MySQL. | Sukses |
| 2 | Login akun terdaftar | Username dan password valid | Token akses JWT dikembalikan, sistem mengarahkan ke dashboard. | Sukses |
| 3 | Pembuatan proyek baru | Nama dan deskripsi proyek | Proyek berhasil dibuat dan terdaftar di sidebar dashboard. | Sukses |
| 4 | Unggah dataset CSV | File CSV (Retail Sales) | Berkas berhasil diunggah ke MinIO dan dipratinjau di UI. | Sukses |
| 5 | Unggah dataset Excel | File XLSX (Used Car Ford) | Berkas berhasil diunggah ke MinIO dan dipratinjau di UI. | Sukses |
| 6 | Analisis EDA bahasa alami | Pertanyaan: "Lakukan EDA pada dataset" | Agen menyusun tugas, menulis kode Pandas, dan merangkum hasil. | Sukses |
| 7 | Render grafik visualisasi | Pertanyaan: "Buat chart usia" | Gambar PNG tersimpan di MinIO dan dirender di obrolan. | Sukses |
| 8 | Pembuatan profil data otomatis | Pertanyaan: "Buat profiling data" | Pustaka profil data mengeksekusi HTML laporan dan tombol unduh muncul. | Sukses |
| 9 | Ekspor Jupyter Notebook | Pertanyaan: "Ekspor ke notebook" | Berkas `.ipynb` dengan histori sel kode berhasil dibuat dan diunduh. | Sukses |
| 10 | Klarifikasi multi-dataset | Pertanyaan umum pada proyek dengan >1 dataset | Agen memicu respons klarifikasi pilihan ganda dataset di chat. | Sukses |
| 11 | Penolakan kode berbahaya | Input kode dengan modul `os.system` | Validator memblokir eksekusi sebelum dikirim ke sandbox. | Sukses |
| 12 | Penanganan timeout sandbox | Eksekusi kode `while True` | Kontainer dihentikan tepat pada batas 120 detik, menampilkan error. | Sukses |
| 13 | Pembuatan dasbor interaktif | Pertanyaan: "Buat dashboard data" | Skema tata letak visual JSON dibuat dan dasbor interaktif dirender. | Sukses |
| 14 | Unduh dataset via URL | URL tautan CSV eksternal | Dataset berhasil diunduh secara server-side dan masuk ke proyek. | Sukses |
| 15 | Reconnect koneksi SSE | Refresh halaman saat analisis berjalan | Client terhubung kembali ke Redis event list buffer dan render berlanjut. | Sukses |

Berdasarkan data pada Tabel 4.1, seluruh 15 skenario pengujian fungsionalitas sistem AnalisAI menunjukkan status **Sukses**. Hal ini menunjukkan makna bahwa platform yang dirancang telah berhasil mengintegrasikan seluruh pipa komponen (*FastAPI, React, Redis queue, MinIO, DuckDB, dan Worker*) untuk memenuhi kebutuhan pengguna non-teknis secara fungsional tanpa mengalami malafungsi sistem.

---

## 4.3 Hasil Pengujian Keamanan Docker Sandbox

Pengujian keamanan dilakukan secara khusus untuk memvalidasi efektivitas isolasi keamanan *Docker sandbox* terhadap potensi eksploitasi kode berbahaya yang ditulis LLM secara dinamis. Hasil pengujian dari 5 skenario keamanan dirinci pada Tabel 4.2.

**Tabel 4.2 Hasil Pengujian Keamanan Docker Sandbox**

| No | Eksperimen Eksploitasi Keamanan | Deteksi / Pencegahan Mekanisme | Hasil Pengujian Sandbox | Status Keamanan |
|:---:|---|---|---|:---:|
| 1 | Eksekusi injeksi kode Python berbahaya (`subprocess.Popen`, `os.system`, `eval('__import__')`) | Pemindaian berbasis *Regular Expressions* (regex) di host dan pembatasan runtime. | Kode diblokir secara preventif di host sebelum dikirim ke kontainer. | Terlindungi |
| 2 | Percobaan akses jaringan dari dalam sandbox (`urllib.request.urlopen`, `socket.connect`) | Konfigurasi kontainer dengan `network_disabled=True`. | Terjadi kegagalan jaringan internal (*OSError/Network unreachable*). Kode gagal dieksekusi. | Terlindungi |
| 3 | Konsumsi memori ekstrem (alokasi array raksasa tak terbatas) | Batasan kapasitas RAM kontainer sebesar `mem_limit=512m`. | Proses di dalam kontainer dihentikan paksa oleh kernel host (*OOM Killed*), host tetap stabil. | Terlindungi |
| 4 | Eksekusi loop tak terbatas (`while True: pass`) | Batas waktu eksekusi host (*timeout loop timer*) maksimal 120 detik. | Pintu gerbang pemantau host memicu pembatalan tugas, kontainer dihancurkan secara paksa. | Terlindungi |
| 5 | Pengisian ruang penyimpanan disk secara masif (pembuatan berkas dummy gigabyte) | Pembatasan hak akses tulis direktori host di dalam kontainer. | Penulisan ditolak di luar direktori bersama `/app/data/`, mencegah host kehabisan disk. | Terlindungi |

Hasil pada Tabel 4.2 membuktikan bahwa sistem AnalisAI memiliki tingkat ketahanan yang sangat tinggi terhadap serangan berbasis injeksi kode program. Mekanisme pengamanan ganda (analisis statis regex di host dan pembatasan isolasi dinamis Docker) berhasil mengeliminasi celah kerentanan di mana LLM menghasilkan instruksi kode yang berpotensi merusak atau mencuri informasi sensitif dari mesin host utama. Hal ini sangat penting untuk menjamin stabilitas infrastruktur komputasi di lingkungan produksi.

---

## 4.4 Hasil Evaluasi Kualitas Hasil Analisis AI

Pengujian terhadap kualitas intepretasi analitik, kebenaran penulisan program, serta tingkat keterbacaan penjelasan yang diproduksi oleh agen ReAct dinilai secara kualitatif dan kuantitatif oleh 3 evaluator ahli (*data analysts*). Evaluasi ini dilakukan terhadap 10 sampel skenario tanya-jawab analisis data menggunakan dataset *Retail Sales* (Skenario 1 s.d 5) dan *Used Car Ford* (Skenario 6 s.d 10). Hasil penilaian dirangkum pada Tabel 4.3.

**Tabel 4.3 Skor Rata-Rata Evaluasi Kualitas Jawaban AI**

| Skenario Uji | Deskripsi Tugas Analisis Data | Relevansi (1–5) | Akurasi (1–5) | Kelengkapan (1–5) | Keterbacaan (1–5) |
|:---:|---|:---:|:---:|:---:|:---:|
| 1 | Pembersihan nilai kosong & inkonsistensi | 5.0 | 4.7 | 4.3 | 4.7 |
| 2 | Perhitungan statistik deskriptif ritel | 5.0 | 5.0 | 4.7 | 5.0 |
| 3 | Visualisasi histogram sebaran umur pelanggan | 4.7 | 4.7 | 4.7 | 4.7 |
| 4 | Analisis tren penjualan bulanan (*time-series*) | 4.7 | 4.7 | 4.3 | 4.7 |
| 5 | Korelasi kategori produk dan total transaksi | 5.0 | 4.3 | 4.7 | 5.0 |
| 6 | Pembersihan pencilan (*outliers*) Used Car | 4.7 | 4.7 | 4.3 | 4.3 |
| 7 | Visualisasi matriks korelasi harga mobil | 4.7 | 4.7 | 4.7 | 4.7 |
| 8 | Profiling otomatis keseluruhan dataset | 5.0 | 4.7 | 5.0 | 5.0 |
| 9 | Ekspor analisis ke Jupyter Notebook | 5.0 | 5.0 | 5.0 | 5.0 |
| 10 | Analisis pengaruh transmisi ke harga mobil | 5.0 | 4.7 | 4.3 | 4.7 |
| **Rata-rata** | **Skor Total Aspek Kualitas** | **4.88** | **4.73** | **4.60** | **4.78** |

### Pembahasan Kualitas AI dan Kesenjangan Penelitian (*Research Gaps*)

Evaluasi kualitas pada Tabel 4.3 menunjukkan kinerja yang sangat baik dengan skor rata-rata keseluruhan berada di atas **4.60** dari skala maksimal **5.00**. Skor tertinggi diperoleh pada aspek **Relevansi (4.88)**, menunjukkan bahwa model LLM dengan arsitektur ReAct memiliki pemahaman konteks bahasa alami pengguna yang sangat presisi dalam menerjemahkan pertanyaan menjadi langkah kerja konkret. Aspek **Akurasi (4.73)** dan **Keterbacaan (4.78)** juga mendapatkan nilai yang tinggi, membuktikan efektivitas integrasi pustaka visualisasi Python dan DuckDB SQL dalam menghasilkan jawaban analisis terstruktur.

Meskipun demikian, terdapat kesenjangan penelitian (*research gaps*) dan batasan operasional penalaran LLM yang diidentifikasi dari evaluasi aspek **Kelengkapan (4.60)**:
1. **Iterasi Penanganan Kode Error**: Ketika LLM menulis kode yang mengalami kegagalan eksekusi (*syntax error* atau *key error* Pandas) di dalam sandbox, agen ReAct terkadang memerlukan 2 hingga 3 kali siklus pengulangan penalaran (*retry loop*) untuk memperbaiki kode secara mandiri. Meskipun agen pada akhirnya berhasil menjawab pertanyaan (sukses fungsi), pengulangan ini menghasilkan waktu tunggu respons (*latency*) yang lebih lama bagi pengguna.
2. **Keterbatasan Analisis Kualitatif Pencilan (*Outliers*)**: Pada Skenario 6, agen AI mampu mendeteksi data pencilan (seperti mobil bekas dengan tahun produksi tidak masuk akal atau harga ekstrim) secara programatik menggunakan metode IQR (*Interquartile Range*). Namun, penjelasan kualitatif mengenai alasan terjadinya pencilan tersebut bersifat generik dan kurang mendalam. Agen AI kesulitan menjelaskan anomali data di luar angka-angka komputasi tanpa adanya metadata penjelasan konteks bisnis tambahan.
3. **Ketergantungan terhadap Kualitas Prompt**: Jika pengguna memberikan perintah bahasa alami yang terlampau ambigu atau tidak menyertakan batasan kolom yang ingin dianalisis pada dataset besar, agen cenderung menghasilkan kode analisis yang terlalu umum sehingga mengabaikan detail-detail statistik minor tertentu.

Temuan kesenjangan ini membuktikan pentingnya perancangan *prompt engineering* yang ketat serta perlunya intervensi manusia (*Human-in-the-loop*) pada sistem analitik otomatis di masa mendatang guna melengkapi interpretasi konteks bisnis yang tidak dapat dicapai oleh komputasi numerik LLM murni.

---

## 4.5 Hasil Pengujian Penerimaan Pengguna (User Acceptance Testing - UAT)

Pengujian UAT dilakukan dengan melibatkan 10 responden pengguna yang mewakili target pengguna non-teknis, terdiri dari 5 analis data (*data analysts*) dan 5 pengguna bisnis umum. Setiap responden diminta untuk menyelesaikan sejumlah tugas analisis data menggunakan platform AnalisAI, kemudian mengisi kuesioner evaluasi yang dirancang menggunakan **Skala Likert 1–5** dengan rincian bobot penilaian sebagai berikut:
- Skor 1: Sangat Tidak Setuju (STS)
- Skor 2: Tidak Setuju (TS)
- Skor 3: Netral (N)
- Skor 4: Setuju (S)
- Skor 5: Sangat Setuju (SS)

Aspek-aspek yang dievaluasi dalam kuesioner UAT meliputi:
1. **Kemudahan penggunaan**: Seberapa mudah pengguna memahami dan mengoperasikan antarmuka percakapan.
2. **Keakuratan hasil analisis**: Seberapa tepat dan relevan hasil analisis yang dihasilkan agen terhadap pertanyaan pengguna.
3. **Kualitas visualisasi**: Seberapa informatif dan jelas grafik yang dihasilkan oleh sistem.
4. **Responsivitas sistem**: Seberapa cepat sistem merespons permintaan pengguna.
5. **Kepuasan keseluruhan**: Penilaian umum terhadap pengalaman menggunakan platform.

Skor hasil pengisian kuesioner dihitung persentase kelayakannya menggunakan rumus matematika berikut:

$$\text{Persentase Kelayakan} = \frac{\text{Skor Diperoleh}}{\text{Skor Maksimum}} \times 100\%$$

Di mana:
- **Skor Diperoleh**: Jumlah total nilai yang diberikan oleh seluruh responden untuk suatu aspek pernyataan.
- **Skor Maksimum**: Skor tertinggi skala Likert (5) dikalikan dengan jumlah pernyataan dan jumlah responden ($5 \times \text{jumlah pernyataan} \times \text{jumlah responden}$).

Hasil persentase UAT dikelompokkan ke dalam kategori tingkat kelayakan untuk diinterpretasikan berdasarkan klasifikasi pada Tabel 3.10 (Bab III).

**Tabel 4.4 Perolehan Skor Pengujian Penerimaan Pengguna (UAT)**

| No | Aspek Pernyataan Kuesioner UAT | Skor Responden (1–10) | Total Skor | Skor Maksimal | Persentase Kelayakan | Kategori Kelayakan |
|:---:|---|---|:---:|:---:|:---:|:---:|
| 1 | Antarmuka obrolan AnalisAI mudah dipahami dan digunakan oleh pengguna non-teknis. | 4, 5, 4, 4, 5, 5, 4, 4, 5, 4 | 44 | 50 | 88.0% | Sangat Layak |
| 2 | Respons agen dalam menjawab pertanyaan analisis data relevan dan akurat. | 4, 4, 4, 5, 4, 4, 5, 4, 4, 4 | 42 | 50 | 84.0% | Sangat Layak |
| 3 | Grafik visualisasi yang disajikan jelas, lengkap, dan informatif. | 4, 5, 5, 4, 4, 5, 4, 5, 4, 5 | 45 | 50 | 90.0% | Sangat Layak |
| 4 | Kecepatan respons (*streaming*) dan penanganan pekerjaan analisis tergolong cepat. | 4, 4, 4, 4, 3, 4, 5, 4, 4, 4 | 40 | 50 | 80.0% | Layak / Baik |
| 5 | Fitur ekspor berkas dan widget rencana tugas sangat membantu jalannya analisis. | 5, 5, 4, 5, 4, 5, 5, 4, 4, 4 | 45 | 50 | 90.0% | Sangat Layak |
| **Total**| **Akumulasi Penilaian Keseluruhan Aspek UAT** | | **216** | **250** | **86.4%** | **Sangat Layak** |

### Perhitungan Persentase Kelayakan UAT

Berdasarkan data dari Tabel 4.4, perhitungan persentase kelayakan total sistem diperoleh melalui perhitungan matematika berikut:

$$\text{Persentase Kelayakan} = \frac{\text{Skor Diperoleh}}{\text{Skor Maksimum}} \times 100\%$$

$$\text{Persentase Kelayakan} = \frac{216}{250} \times 100\% = 86.4\%$$

Berdasarkan Kriteria Klasifikasi Kelayakan UAT yang didefinisikan pada Tabel 3.10 (Bab III), skor akumulasi rata-rata sebesar **86.4%** berada pada interval **81% – 100%**, yang menempatkan platform AnalisAI ke dalam klasifikasi **Sangat Layak (Sangat Baik)**. 

Interpretasi dari hasil UAT ini menunjukkan bahwa:
- Visualisasi grafik data yang dihasilkan otonom oleh agen otonom memperoleh respon kepuasan yang sangat tinggi (90.0%) karena ketajaman visualisasi Matplotlib/Seaborn yang dirender secara tepat.
- Kehadiran fitur pendukung seperti widget rencana tugas (*TaskWidget*) dan ekspor hasil analitik memudahkan pengguna memantau alur penalaran ReAct agen (90.0%).
- Kecepatan respons streaming (80.0%) memiliki skor terendah di antara kriteria lainnya. Pembahasan kualitatif responden menunjukkan bahwa waktu jeda eksekusi kode (I/O container startup, volume write, dan interaksi LLM API) dapat ditingkatkan lebih lanjut dengan optimalisasi pooling kontainer siap pakai (*container pooling*), meskipun performa saat ini dinilai sudah cukup baik untuk skenario analitik non-kritis.

Dengan demikian, hasil UAT ini membuktikan secara ilmiah bahwa platform AnalisAI berhasil memecahkan rumusan masalah dan mencapai tujuan penelitian utama, yaitu menghadirkan solusi analisis data otomatis yang aman, handal, dan mudah dioperasikan bagi pengguna non-teknis.
