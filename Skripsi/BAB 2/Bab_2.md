# BAB II

# TINJAUAN PUSTAKA

Bab ini membahas landasan teori dan tinjauan literatur yang mendasari pengembangan platform AnalisAI berbasis *single-agent* dengan *tool calling* dan *Python sandbox*. Pembahasan mencakup penelitian terdahulu yang relevan, teori analisis data, teori dasbor analitik, konsep arsitektur agen tunggal berbasis *Reasoning and Acting* (ReAct), kerangka orkestrasi kognitif menggunakan LangGraph, mekanisme pemanggilan alat (*tool calling*), pemrosesan analitik menggunakan DuckDB, serta aspek keamanan kontainer menggunakan teknologi Docker.

---

## 2.1. Penelitian Terdahulu

Penelitian mengenai otomatisasi analisis data dan agen kecerdasan buatan berbasis *Large Language Models* (LLM) telah berkembang pesat dalam beberapa tahun terakhir. Berbagai studi memfokuskan pada pemanggilan alat eksternal (*tool calling*), integrasi basis data analitik, serta mekanisme isolasi eksekusi kode demi keamanan. Matriks penelitian terdahulu pada Tabel 2.1 berikut menggambarkan perbandingan fokus penelitian, metodologi yang digunakan, serta kontribusi unik dari masing-masing literatur yang menjadi pijakan dalam penelitian ini.

Selain fokus pada kegunaan analitik, penelitian terbaru juga menekankan pentingnya pengembangan kerangka kerja evaluasi kognitif untuk menilai kemampuan agen dalam menghasilkan kueri SQL dan visualisasi data yang akurat. Pendekatan ini memungkinkan pemetaan kebutuhan bisnis ke dalam struktur data relasional secara otonom dengan meminimalkan tingkat halusinasi informasi yang sering terjadi pada model bahasa besar.

Di sisi lain, keamanan lingkungan eksekusi kode (*sandbox*) dan efisiensi komunikasi antar-layanan (seperti REST API) menjadi pilar utama untuk memastikan platform dapat berjalan secara aman di lingkungan produksi. Uji coba penetrasi keamanan kontainer dan pengukuran latensi transmisi data sangat krusial dalam merancang arsitektur sistem yang responsif dan tahan terhadap ancaman injeksi kode berbahaya.

**Tabel 2.1. Matriks Perbandingan Penelitian Terdahulu**

| Peneliti & Tahun | Fokus Penelitian | Metodologi / Teknologi | Kelebihan & Hasil Utama | Relevansi dengan Sistem AnalisAI |
| :--- | :--- | :--- | :--- | :--- |
| **Jansen, Manukyan, Al Khoury & Akalin (2025)** | Otomatisasi analisis data menggunakan LLM | Rekayasa prompt dan *self-correction code execution* | Mekanisme *self-correction* meningkatkan persentase eksekusi kode sukses secara signifikan | Dasar implementasi penanganan error eksekusi kode pada *sandbox* |
| **Yao, Zhao, Yu, Du, Shafran, Narasimhan & Cao (2023)** | Orkestrasi penalaran (*reasoning*) dan tindakan (*acting*) | Metode ReAct (*Reasoning and Acting*) pada LLM | Mengatasi masalah *hallucination* dan penumpukan kesalahan dalam penalaran | Konsep inti arsitektur agen tunggal yang mengevaluasi hasil *action* secara iteratif |
| **Schick, Dwivedi-Yu, Dessì, Raileanu, Lomeli, Zettlemoyer, Cancedda & Scialom (2023)** | Kemampuan LLM dalam menggunakan alat eksternal | Model Toolformer, *self-supervised learning* | LLM dapat memutuskan secara otonom alat mana yang akan dipanggil dan parameternya | Landasan teori mekanisme pemanggilan *tool* (seperti eksekusi kode Python) oleh LLM |
| **Li, Zhou & Zhao (2024)** | Pemanfaatan LLM dalam manajemen data dan analitik | Survey metode RAG, *vector databases*, dan *multi-round agents* | Menemukan bahwa alur kerja agen *multi-round* krusial untuk mengatasi halusinasi kueri kompleks | Dasar konsep penggunaan agen LLM untuk interaksi basis data analitik |
| **Haq, Nguyen, Vollmer, Tosun, Korkmaz & Sadeghi (2024)** | Analisis keamanan infrastruktur Docker kontainer | Metode SoK (*Systematic of Knowledge*) Docker Security | Mengidentifikasi celah keamanan kontainer dan konfigurasi isolasi | Dasar implementasi *Docker Sandbox* terisolasi tanpa akses jaringan luar |
| **Ain, Ardiansyah, Pratama, Akbar & Lapatta (2025)** | Komparasi performa REST API dan gRPC | Analisis kuantitatif latensi, *throughput*, dan *payload* | Memberikan metrik performa REST API di berbagai kondisi beban trafik | Dasar perancangan REST API dan *streaming* SSE pada arsitektur *server-side* |

---

### 2.2. Analisis Data

Analisis data secara akademis merupakan proses inspeksi, pembersihan, transformasi, dan pemodelan data dengan tujuan menemukan informasi yang berguna, menginformasikan kesimpulan, serta mendukung pengambilan keputusan bisnis maupun operasional. Dalam konteks sistem analisis data otomatis berbasis kecerdasan buatan, proses ini diterjemahkan ke dalam beberapa tahapan komputasi yang terstruktur.

<!-- TODO: Sisipkan diagram siklus alur kerja data science (Import -> Clean -> Transform -> Model -> Visualize -> Communicate) di sini -->
**[Gambar 2.5: Siklus Alur Kerja Data Science (Data Science Workflow)]**

### 2.2.1. Data Cleaning
*Data cleaning* atau pembersihan data adalah langkah awal yang sangat krusial dalam siklus analisis data. Proses ini melibatkan deteksi, koreksi, atau penghapusan catatan yang tidak akurat, tidak lengkap, atau tidak konsisten dari dataset. Menurut Wickham, Çetinkaya-Rundel & Grolemund (2023) dalam konsep penyusunan dataset terstruktur, data yang kotor dapat menghambat proses analisis dan menghasilkan kesimpulan yang bias. Pembersihan data dalam sistem otomatis ini mencakup penanganan nilai yang hilang (*missing values*), deteksi data pencilan (*outliers*), penghapusan duplikasi, serta penyelarasan tipe data agar siap diproses lebih lanjut, sejalan dengan taksonomi pembersihan data modern (Babli, Gairola, Ogbu, Longa, Rautaray, Alamu & Rizvi, 2026).

### 2.2.2. Data Transformation
*Data transformation* atau transformasi data adalah proses mengubah format, struktur, atau nilai data agar lebih sesuai untuk kebutuhan analisis. Berdasarkan prinsip pengolahan data terstruktur (Wickham et al., 2023), transformasi ini mencakup operasi seperti penyaringan baris (*filtering*), pemilihan kolom (*selecting*), pengurutan data (*sorting*), penggabungan dataset (*joining*), pembuatan variabel baru (*feature engineering*), serta agregasi data. Transformasi data yang sistematis memastikan dataset berada dalam bentuk optimal sebelum divisualisasikan atau dimodelkan secara statistik.

### 2.2.3. Exploratory Data Analysis (EDA)
*Exploratory Data Analysis* (EDA) atau analisis data eksploratif adalah suatu pendekatan analisis dataset untuk merangkum karakteristik utamanya, yang sebagian besar menggunakan metode visual (Li, Zhou & Zhao, 2024). Tujuan utama EDA adalah untuk memahami struktur data secara mendalam, mendeteksi anomali, menguji hipotesis, dan memeriksa asumsi dasar sebelum melakukan pemodelan formal. Pendekatan analisis eksploratif menekankan pentingnya fleksibilitas dalam mengeksplorasi data tanpa dibatasi oleh model matematika yang kaku di awal, sehingga memungkinkan penemuan pola-pola tersembunyi secara otonom oleh analis (Li, Zhou & Zhao, 2024).

### 2.2.4. Data Visualization
*Data visualization* atau visualisasi data adalah representasi grafis dari informasi dan data dengan menggunakan elemen visual seperti grafik, bagan, dan peta. Visualisasi data bukan sekadar menampilkan angka dalam bentuk gambar, melainkan sebuah metode komunikasi untuk menyampaikan pesan penting di balik data (*storytelling with data*). Visualisasi yang efektif menerapkan prinsip-prinsip desain visual yang baik guna meminimalkan beban kognitif pengguna serta membantu mereka mengidentifikasi tren, pola, dan korelasi yang tidak terlihat secara langsung pada data mentah, dengan memanfaatkan representasi visual yang terstruktur (Sarikaya, Correll, Bartram, Tory & Fisher, 2019).

### 2.2.5. Statistical Summary
*Statistical summary* atau ringkasan statistik memberikan gambaran kuantitatif mengenai karakteristik utama dari dataset. Ini mencakup statistik deskriptif dasar seperti ukuran pemusatan data (rata-rata, median, modus), ukuran penyebaran data (standar deviasi, varians, jangkauan), nilai minimum dan maksimum, serta distribusi kuartil. Ringkasan statistik ini memberikan fondasi numerik awal bagi agen cerdas untuk memahami bentuk distribusi data sebelum melakukan analisis visual yang lebih spesifik..

---

## 2.3. Dashboard Analytics

Pengembangan sistem analisis data modern sering kali melibatkan penyajian informasi hasil analisis dalam bentuk dasbor interaktif. Teori mengenai *dashboard analytics* mencakup aspek penyusunan visual, interaktivitas, dan integrasinya dengan kebutuhan bisnis.

### 2.3.1. Definisi Dashboard
*Dashboard* adalah representasi visual dari informasi paling penting yang diperlukan untuk mencapai satu atau lebih sasaran, yang dikonsolidasikan dan diatur dalam satu layar tunggal sehingga informasi tersebut dapat dipantau sekilas oleh pengguna (Sarikaya, Correll, Bartram, Tory & Fisher, 2019). Dasbor yang dirancang dengan baik harus mampu menyampaikan pesan utama secara cepat, akurat, dan intuitif tanpa membebani kognisi pengguna dengan elemen dekoratif yang tidak relevan, yang sering kali dijabarkan sebagai prinsip kesederhanaan visual dasbor (Sarikaya et al., 2019).

### 2.3.2. KPI Visualization
Visualisasi *Key Performance Indicators* (KPI) merupakan inti dari fungsionalitas dasbor. KPI adalah metrik operasional maupun strategis yang digunakan untuk mengukur efektivitas organisasi dalam mencapai sasaran kerjanya. Menurut Sarikaya et al. (2019), visualisasi KPI yang efektif tidak hanya menampilkan nilai terkini, tetapi juga harus menyediakan konteks pembanding seperti target kerja, batas ambang batas (*threshold*), serta tren historis untuk mempermudah evaluasi kinerja secara objektif.

### 2.3.3. Interactive Dashboard
*Interactive dashboard* memberikan kebebasan bagi pengguna untuk mengeksplorasi data secara mandiri melalui manipulasi visual secara langsung. Fitur interaktivitas yang umum meliputi penyaringan data (*filtering*), penelusuran lebih dalam (*drill-down*), pengurutan variabel (*sorting*), serta kemampuan untuk mengubah jenis grafik secara dinamis. Interaktivitas ini sangat penting dalam analisis data eksploratif karena memungkinkan pengguna beralih dari pandangan makro (ringkasan eksekutif) ke pandangan mikro (detail transaksi) secara instan.

Dalam arsitektur platform analitik modern, interaktivitas tingkat tinggi ini dicapai dengan merepresentasikan komponen visual ke dalam berkas konfigurasi terstruktur seperti skema JSON. Skema ini dibaca oleh aplikasi frontend untuk merender grafik secara dinamis, sementara kueri analitik di sisi server maupun klien dieksekusi menggunakan mesin basis data analitik berkinerja tinggi (seperti DuckDB) untuk menghasilkan agregasi data instan tanpa membebani memori utama host.

<!-- TODO: Sisipkan ilustrasi tata letak (mockup) dashboard interaktif yang terdiri dari KPI Cards, charts, dan panel filter di sini -->
**[Gambar 2.6: Rancangan Konseptual Tata Letak Dasbor Interaktif (Dashboard Layout Mockup)]**

### 2.3.4. Business Intelligence Dashboard
Dalam konteks organisasi, dasbor terintegrasi erat dengan sistem *Business Intelligence* (BI). Bavaresco et al. (2020) membagi dasbor BI ke dalam tiga kategori utama berdasarkan target penggunanya:
1. **Dasbor Operasional**: Digunakan oleh staf teknis untuk memantau aktivitas harian dan metrik waktu nyata (*real-time*).
2. **Dasbor Taktis**: Digunakan oleh manajer untuk menganalisis proses bisnis, tren mingguan atau bulanan, dan membandingkan performa antar sub-unit.
3. **Dasbor Strategis**: Digunakan oleh jajaran eksekutif untuk memantau pencapaian visi jangka panjang organisasi dan metrik kesehatan bisnis secara menyeluruh.

---

## 2.4. Arsitektur Single-Agent ReAct

Pendekatan *Reasoning and Acting* (ReAct) mengintegrasikan kemampuan bernalar (*reasoning*) dan bertindak (*acting*) secara terpadu di dalam sebuah *Large Language Model* (LLM) (Yao et al., 2023). Melalui metode ReAct, LLM dapat menghasilkan langkah-langkah penalaran (*thought processes*) sebelum mengambil tindakan (*action*) berupa pemanggilan alat eksternal. Hasil eksekusi dari alat tersebut kemudian diumpankan kembali ke LLM sebagai observasi (*observation*), yang memicu siklus penalaran berikutnya.

Tidak seperti arsitektur *multi-agent* yang membagi tugas spesifik ke beberapa agen mandiri yang saling berkomunikasi, sistem ini menerapkan arsitektur *Single-Agent ReAct*. Seluruh logika—mulai dari deteksi niat pengguna (*intent detection*), perencanaan analisis, penulisan kode Python, hingga penulisan kesimpulan akhir—dipusatkan pada satu agen tunggal (Xi et al., 2025; Sumers et al., 2024). Arsitektur ini dipilih dengan pertimbangan utama sebagai berikut:
1. **Konsistensi Konteks**: Seluruh riwayat analisis dan hasil eksekusi *tool* tersimpan dalam satu *state* memori tunggal, meminimalkan risiko hilangnya informasi krusial saat perpindahan agen.
2. **Efisiensi Rute**: Menghilangkan *overhead* latensi komunikasi dan kompleksitas routing antar-agen yang sering ditemui pada sistem *multi-agent*.
3. **Iterasi Proses Penalaran**: Agen dapat mengevaluasi dan merencanakan kembali langkah berikutnya dalam satu alur percakapan yang berkelanjutan.

Siklus penalaran dan tindakan yang terjadi pada agen ReAct diilustrasikan secara detail pada Gambar 2.1.

```mermaid
graph TD
    User([User Input / Prompt]) --> Agent{Single ReAct Agent}
    Agent -->|1. Thought: Rencana Tindakan| Think[Penalaran / Thought]
    Think -->|2. Action: Pilih Tool & Parameter| Tool[Panggil Tool / Action]
    Tool -->|3. Observation: Hasil Eksekusi| Obs[Observasi Hasil / Observation]
    Obs -->|Looping Evaluasi| Agent
    Agent -->|4. Final Answer: Ringkasan Analisis| Out([Jawaban Akhir / Response])
```
**[Gambar 2.1: Diagram Alur Penalaran dan Tindakan Agen ReAct (Siklus Thought-Action-Observation)]**

---

## 2.5. Orkestrasi Alur Kerja Agen dengan LangGraph

LangChain menyediakan abstraksi untuk merangkai interaksi LLM dengan alat-alat eksternal secara linier. Namun, untuk sistem analisis data interaktif yang memerlukan logika siklik—seperti siklus ReAct yang berjalan berulang kali hingga hasil analisis ditemukan—diperlukan kerangka kerja orkestrasi yang lebih ekspresif. LangGraph digunakan sebagai mesin pengelola alur kerja kognitif (*cognitive architecture*) pada sistem ini untuk menstrukturkan memori, perencanaan, dan pemanggilan alat secara dinamis (Chase, 2023; Sumers, Yao, Narasimhan & Griffiths, 2024).

### 2.5.1. Directed Cyclic Graph (DCG) pada LangGraph
Berbeda dengan alat bantu *workflow* data tradisional (seperti Apache Airflow) yang dibatasi oleh aturan *Directed Acyclic Graph* (DAG), LangGraph secara eksplisit memodelkan hubungan antar-node sebagai graf terarah bersiklus atau *Directed Cyclic Graph* (DCG). Desain ini sangat krusial karena siklus interaksi antara node Agen dan node Alat (*Tools*) bersifat rekursif. Agen dapat memanggil alat eksekusi kode berkali-kali sampai LLM mendeteksi bahwa data telah siap diinterpretasikan. Alur graf terarah bersiklus pada sistem ini digambarkan pada Gambar 2.2.

**[Gambar 2.2: Contoh Visualisasi Alur Siklik (DCG) pada Node LangGraph]**

```mermaid
graph LR
    START([__start__]) --> Agent[Node: Agent]
    Agent -->|Decision: Call Tool?| Cond{Router}
    Cond -->|Yes| Tools[Node: Tools]
    Tools -->|Return Tool State| Agent
    Cond -->|No| END([__end__])
```

### 2.5.2. State Management
Orkestrasi pada LangGraph berbasis pada *State* terpusat yang didefinisikan sebagai skema data bersama (*shared schema*) antar seluruh node dalam graf. Setiap node direpresentasikan sebagai fungsi Python yang menerima *State* saat ini sebagai argumen dan mengembalikan pembaruan (*updates*) ke dalam *State* tersebut. Pengelolaan *State* ini menggunakan mekanisme *reducer*, yang mendefinisikan bagaimana nilai baru digabungkan dengan nilai yang sudah ada (misalnya, menambahkan pesan baru ke dalam riwayat percakapan tanpa menghapus pesan sebelumnya). Hal ini memastikan konsistensi data selama siklus eksekusi agen.

### 2.5.3. MemorySaver dan Durable Execution
Untuk mendukung interaksi multi-sesi dan ketahanan sistem, LangGraph menyediakan mekanisme checkpointer seperti `MemorySaver` (Chase, 2023). Checkpointer bertindak sebagai media penyimpanan status (*state store*) yang secara otomatis menyimpan cuplikan (*snapshot*) dari *State* graf pada setiap langkah eksekusi. 

Terdapat dua kategori utama checkpointer dalam ekosistem LangGraph:
1.  ***In-Memory Checkpointer* (`MemorySaver`)**: Menyimpan status grafik langsung di dalam memori RAM server. Pendekatan ini sangat efisien untuk melacak siklus langkah eksekusi agen cerdas (*thought-action-observation loop*) dalam satu giliran panggilan aktif (*active run*), namun datanya bersifat sementara (*volatile*) dan akan hilang apabila server dimatikan atau di-restart.
2.  ***Persistent Checkpointer* (seperti `PostgresSaver` atau database eksternal)**: Menyimpan status grafik secara fisik pada penyimpanan persisten untuk menjamin data tetap utuh dari kegagalan server total.

Mekanisme *checkpointing* ini mendukung *Durable Execution*, di mana jika terjadi gangguan koneksi atau kegagalan server di tengah proses analisis yang panjang, sistem dapat memulihkan status agen ke langkah terakhir yang sukses tanpa harus mengulang proses analisis dari awal. Hal ini juga memungkinkan sesi analisis data bersifat dapat diputar kembali (*replayable*). Pada sistem AnalisAI, persistensi jangka panjang untuk riwayat obrolan di luar siklus eksekusi agen didelegasikan kepada basis data Redis sebagai penyimpanan sesi utama.

### 2.5.4. Human-in-the-loop (HITL)
Salah satu fitur paling krusial dari LangGraph dalam konteks analisis data adalah dukungan bawaan untuk interaksi *Human-in-the-loop* (HITL). LangGraph memungkinkan graf untuk diinterupsi secara otonom sebelum node tertentu dijalankan (misalnya, sebelum mengeksekusi kode Python yang berpotensi memiliki biaya komputasi tinggi atau mengubah database). Selama interupsi, status agen ditangguhkan, dan kendali diberikan kepada pengguna untuk meninjau kode yang dihasilkan oleh LLM, memberikan persetujuan (*approval*), memberikan umpan balik (*feedback*), atau melakukan modifikasi langsung pada *State* sebelum proses dilanjutkan.

### 2.5.5. Perbandingan LangGraph dengan LangChain Konvensional
Untuk memperjelas keunggulan LangGraph dalam skenario agen analisis data, Tabel 2.2 menyajikan perbandingan fungsional antara LangChain konvensional dan LangGraph.

**Tabel 2.2. Perbandingan Fungsionalitas LangChain Konvensional dan LangGraph**

| Dimensi Perbandingan | LangChain Konvensional | LangGraph |
| :--- | :--- | :--- |
| **Pola Alur Kerja** | Terbatas pada alur linier atau pohon keputusan searah (*Directed Acyclic Graph* / DAG) | Mendukung alur siklik rekursif secara asli (*Directed Cyclic Graph* / DCG) |
| **Manajemen State** | Stateless secara bawaan; membutuhkan logika eksternal yang kompleks untuk memelihara riwayat memori | Stateful dengan skema terpusat dan pembaruan otomatis menggunakan *reducer* |
| **Mekanisme Checkpointing** | Tidak ada dukungan bawaan untuk penyimpanan status pada setiap langkah eksekusi | Memiliki checkpointer bawaan (`MemorySaver`, PostgreSQL) untuk pemulihan kegagalan (*Durable Execution*) |
| **Human-in-the-loop (HITL)** | Sulit diimplementasikan; memerlukan pembuatan modul kustom untuk menangguhkan dan melanjutkan *chain* | Didukung penuh secara asli melalui fungsi *interrupt* dan modifikasi *State* secara dinamis |

Berdasarkan perbandingan pada Tabel 2.2, LangGraph dipilih karena menyediakan struktur data graf bersiklus yang mutlak diperlukan untuk siklus ReAct yang dinamis, serta memiliki fitur manajemen *state* persisten dan interupsi manusia yang terintegrasi secara modular, yang tidak dimiliki secara bawaan oleh LangChain konvensional.

---

## 2.6. Mekanisme Pemanggilan Alat (Tool Calling Mechanism)

*Large Language Model* memiliki keterbatasan mendasar dalam melakukan kalkulasi matematis yang presisi dan tidak memiliki akses langsung ke sistem file komputer. Mekanisme pemanggilan alat (*tool calling*) memecahkan masalah ini dengan melatih LLM untuk mengenali kapan harus mendelegasikan tugas ke program eksternal melalui keluaran terstruktur seperti skema JSON (Schick, Dwivedi-Yu, Dessì, Raileanu, Lomeli, Zettlemoyer, Cancedda & Scialom, 2023).

Dalam sistem asisten analis data ini, agen dilengkapi dengan 8 alat bantu utama yang didefinisikan secara deklaratif di dalam sistem backend. LLM mendeteksi parameter masukan yang dibutuhkan oleh masing-masing fungsi berdasarkan instruksi sistem:
- **python_repl_tool**: Mengirimkan skrip Python yang dihasilkan oleh LLM ke lingkungan eksekusi untuk pengolahan data menggunakan pustaka komputasi Pandas/Numpy.
- **read_data_tool**: Mengambil ringkasan struktur kolom, tipe data, serta nilai kosong dari berkas tabular secara teknik terstruktur sebelum analisis dimulai.
- **render_chart_tool**: Digunakan khusus untuk eksekusi visualisasi data analitik dan pembuatan grafik menggunakan pustaka Matplotlib atau Seaborn.
- **data_profile_tool**: Menghasilkan profil deskriptif lengkap (*profiling report*) berkas data secara otomatis dalam format berkas HTML.
- **file_export_tool**: Mengekspor konten teks hasil analisis ke berbagai berkas keluaran seperti Jupyter Notebook (ipynb), CSV, Excel (xlsx), JSON, Markdown (md), HTML, atau berkas teks.
- **download_dataset_tool**: Mengunduh berkas dataset dari sumber luar atau internet seperti Kaggle API hub atau tautan publik Google Sheets.
- **update_task_list_tool**: Memperbarui status kemajuan tugas (*to-do list*) di widget UI khusus pengguna agar proses analisis terpantau dinamis.
- **bash_tool**: Menjalankan perintah terminal atau shell dasar (seperti `ls`, `pwd`, atau `cat`) di dalam lingkungan sandbox untuk tujuan inspeksi struktur berkas.

Penerapan skema pemanggilan alat terstruktur ini sejalan dengan kerangka kerja penanganan data berbasis LLM yang diperkenalkan oleh Li et al. (2024), yang menunjukkan bahwa efisiensi pemecahan masalah data meningkat secara signifikan ketika LLM difokuskan sebagai perencana, sementara eksekusi teknis didelegasikan ke modul eksternal yang stabil. Alur komunikasi terstruktur ini diilustrasikan secara detail pada Gambar 2.3.

**[Gambar 2.3: Alur Interaksi Komunikasi Tool Calling Terstruktur via JSON Payload]**

```mermaid
sequenceDiagram
    participant LLM as Large Language Model
    participant Backend as Backend System (FastAPI)
    participant Sandbox as Execution Sandbox (Docker)
    
    LLM->>Backend: Kirim respons teks + Tool Call (JSON schema)
    Note over Backend: Validasi kode (Regex/AST) & ekstrak parameter
    Backend->>Sandbox: Tulis _req.json (Kode Python)
    Note over Sandbox: Kernel Loop mengeksekusi kode
    Sandbox-->>Backend: Tulis _res.json (stdout/stderr/chart)
    Backend-->>LLM: Kembalikan observasi (hasil eksekusi)
```## 2.7. Pemrosesan Data Analitik dengan DuckDB

Eksplorasi data interaktif membutuhkan kecepatan komputasi query yang tinggi tanpa membebani memori utama sistem. Sistem ini mengintegrasikan **DuckDB**, sebuah sistem manajemen basis data relasional berbasis kolom (*column-oriented*) yang dirancang khusus untuk beban kerja pemrosesan analitik (*Analytical Processing* / OLAP).

DuckDB memberikan kemampuan eksekusi kueri SQL secara langsung terhadap berkas tabular (seperti CSV, Excel, Parquet, dan JSON) dengan latensi minimal. Berbeda dengan penelitian Kohn, Boncz & Raasveldt (2022) yang memperkenalkan DuckDB-Wasm untuk eksekusi langsung di dalam peramban (*client-side browser*), platform AnalisAI mengimplementasikan DuckDB pada sisi server (*server-side*). Hal ini dikonfigurasi guna menghindari keterbatasan memori pada perangkat pengguna dan mencegah transfer berkas dataset berukuran besar ke peramban, sehingga membantu meningkatkan efisiensi penggunaan lebar pita (*bandwidth*) jaringan serta menjaga kestabilan *render* frontend.

Secara arsitektural, DuckDB memanfaatkan eksekusi kueri tervektorisasi (*vectorized query execution*) yang memproses data dalam blok-blok kolom secara bersamaan, bukan baris demi baris. Pendekatan ini secara signifikan mengurangi beban overhead pemanggilan fungsi instruksi CPU dan memaksimalkan pemanfaatan cache CPU untuk operasi analitik seperti agregasi, penyaringan, dan penggabungan dataset besar. Integrasi DuckDB di dalam lingkungan *sandbox* server-side memastikan data olahan lokal dapat diakses secara instan oleh kode Python yang dijalankan oleh agen tanpa memerlukan latensi jaringan eksternal.

<!-- TODO: Sisipkan diagram perbandingan cara penyimpanan data pada block memory antara Row-Oriented vs Column-Oriented di sini -->
**[Gambar 2.7: Perbandingan Penyimpanan Data Row-Oriented (OLTP) vs Column-Oriented (OLAP)]**

---

## 2.8. Keamanan dan Isolasi Eksekusi (Docker Sandbox)

Mengizinkan LLM menulis dan menjalankan kode Python secara otonom pada sistem utama menghadirkan risiko keamanan bagi sistem host. Kode yang dihasilkan secara tidak sengaja atau melalui teknik injeksi prompt berbahaya (*prompt injection*) dapat menghapus berkas sistem, mencuri data rahasia, atau mengeksploitasi jaringan host (Wong, Chekole, Ochoa & Zhou, 2023). Oleh karena itu, penerapan isolasi eksekusi menggunakan lingkungan terisolasi (*sandbox*) sangat krusial untuk meminimalkan risiko keamanan sistem host.

Sistem *sandbox* pada proyek ini dibangun menggunakan kontainer Docker yang dikonfigurasi dengan kebijakan keamanan ketat berdasarkan kerangka kerja Docker Security (Dakic, 2025; Haq, Nguyen, Vollmer, Tosun, Korkmaz & Sadeghi, 2024):
1. **Isolasi Jaringan (Network Isolation)**: Kontainer dijalankan dengan opsi `network_disabled=True`. Kebijakan ini memutus koneksi internet dari dalam *sandbox*, meminimalkan risiko kebocoran data (*data exfiltration*) atau pengunduhan pustaka berbahaya dari luar selama kode dijalankan.
2. **Pembatasan Sumber Daya**: Memanfaatkan alokasi batas memori (RAM) maksimum sebesar 512 MB dan kuota penggunaan unit pemroses sentral (CPU) melalui pengaturan `mem_limit` dan `cpu_quota` pada Docker SDK. Hal ini dilakukan untuk meminimalkan potensi eksploitasi serangan *Denial of Service* (DoS) akibat *infinite loop* atau konsumsi memori tak terbatas (Dakic, 2025).
3. **Validasi Kode & AST**: Sebelum kode dikirim ke kontainer, backend melakukan penyaringan regex dan analisis sintaksis untuk memblokir impor pustaka sensitif (seperti `subprocess` atau fungsi tertentu dari modul `os`).

Desain arsitektur keamanan *sandbox* Docker terisolasi ini diilustrasikan pada Gambar 2.4.

```mermaid
graph TB
    subgraph Host [Host System]
        API[FastAPI Backend]
        Volume[Shared Directory: project_tmp]
    end
    
    subgraph Docker [Docker Daemon]
        subgraph SandboxContainer [Sandbox Container]
            Kernel[Stateful Kernel Loop]
            Code[Python Execution Context]
        end
    end
    
    API <-->|Write _req.json / Read _res.json| Volume
    Volume <-->|Volume Mount: /app/data| SandboxContainer
    SandboxContainer -.->|Blocked Outbound: Network Disabled| Internet((Internet))
    style Internet fill:#f99,stroke:#333,stroke-width:2px
```
**[Gambar 2.4: Desain Keamanan Arsitektur Sandbox Docker Terisolasi]**th:2p## 2.9. Metode Pengembangan Prototype

Metode *Prototype* atau purwarupa adalah salah satu model pengembangan perangkat lunak yang termasuk dalam paradigma *Evolutionary Process Model* (Pressman, 2015). Metode ini dirancang secara khusus untuk mengatasi kendala ketidakpastian kebutuhan (*requirement*) di awal proyek, di mana pengguna hanya memiliki gambaran umum mengenai sistem yang diinginkan tanpa merinci input, proses, maupun output secara teknis. Melalui pembuatan purwarupa yang cepat, pengguna dapat berinteraksi secara langsung dengan sistem untuk memberikan umpan balik (*feedback*) guna memandu proses perbaikan berkelanjutan.

<!-- TODO: Sisipkan diagram siklus hidup pengembangan prototype (dari Communication, Quick Design, Construction, Evaluation, hingga Refinement) di sini -->
**[Gambar 2.8: Alur Proses Model Pengembangan Prototype (Pressman, 2015)]**

Tahapan utama dalam metode pengembangan *Prototype* secara teoritis meliputi (Pressman, 2015):
1.  **Komunikasi (*Communication*)**: Analis dan pengguna bertemu untuk mendefinisikan sasaran keseluruhan perangkat lunak, mengidentifikasi kebutuhan dasar yang diketahui, dan merencanakan area fokus yang membutuhkan eksplorasi lebih mendalam.
2.  **Perancangan Cepat (*Quick Design*)**: Fokus pada representasi aspek-aspek perangkat lunak yang akan terlihat langsung oleh pengguna (misalnya format tata letak antarmuka dan visualisasi keluaran). Perancangan cepat ini memandu pembangunan purwarupa.
3.  **Pembangunan Purwarupa (*Construction of Prototype*)**: Membuat implementasi fungsional awal dari sistem yang berfokus pada fitur-fitur inti.
4.  **Evaluasi Purwarupa (*Evaluation of Prototype*)**: Purwarupa diserahkan kepada pengguna untuk dicoba dan dievaluasi. Umpan balik yang diperoleh digunakan untuk memperjelas kebutuhan perangkat lunak.
5.  **Perbaikan Berulang (*Iterative Refinement*)**: Proses perancangan, pembangunan, dan evaluasi diulang kembali berdasarkan masukan pengguna hingga purwarupa dinilai telah memenuhi seluruh kebutuhan yang diinginkan sebelum dikembangkan menjadi sistem akhir yang stabil.

Kelebihan utama metode *Prototype* adalah meningkatkan komunikasi dan pemahaman antara pengembang dan pengguna, mendeteksi kesalahan atau ketidaksesuaian fungsionalitas lebih awal, serta mempercepat waktu pengembangan untuk aplikasi yang interaktif. Kekurangan dari metode ini adalah kecenderungan pengembang untuk membuat kompromi teknis (seperti menggunakan algoritma atau pustaka yang tidak optimal) demi membangun purwarupa dengan cepat, serta risiko pengguna yang salah mengira bahwa purwarupa tersebut merupakan sistem akhir yang sudah siap produksi (Pressman, 2015).

---

## Daftar Pustaka

Ain, Moch. Zukhruf, Ardiansyah, Rizka, Pratama, Septiano Anggun, Akbar, Muhammad, & Lapatta, Nouval Trezandy. (2025). Comparative Performance Analysis of GRPC and Rest API Under Various Traffic Conditions and Data Sizes Using a Quantitative Approach. *Journal of Applied Informatics and Computing (JAIC)*, 9(2), 215–224. https://doi.org/10.30871/jaic.v9i2.9276

Babli, Shimul A., Gairola, Pulkit, Ogbu, Chukwuemeka E., Longa, Francesco Alessi, Rautaray, Aditya, Alamu, Opeyemi S., & Rizvi, Syed Faheem Haider. (2026). Evaluating Large Language Models for Automated Data Cleaning and Feature Engineering in Clinical Datasets. *Cureus*, 18(5), e108550. https://doi.org/10.7759/cureus.108550

Bavaresco, Rodrigo Simon, da Silveira, Diórgenes Eugênio, dos Reis, Eduardo Souza, Barbosa, Jorge Luis Victória, Righi, Rodrigo da Rosa, da Costa, Cristiano André, Antunes, Rodolfo Stoffel, Gomes, Márcio Miguel, Gatti, Clauter, Vanzin, Mariângela, Junior, Saint Clair, Silva, Elton, & Moreira, Carlos. (2020). Conversational agents in business: A systematic literature review and future research directions. *Computer Science Review*, 38, 100239. https://doi.org/10.1016/j.cosrev.2020.100239

Chase, Harrison. (2023). LangChain. *GitHub Repository*. Available at: https://github.com/langchain-ai/langchain (Accessed: 14 July 2026).

Dakic, Vladan. (2025). The role of container security in application development. *Edelweiss Applied Science and Technology*, 9(1), 1243–1261. https://doi.org/10.55214/25768484.v9i1.4382

Haq, Muhammad Shahzad, Nguyen, Thanh Dong, Vollmer, Felix, Tosun, Alper Senan, Korkmaz, Turgay, & Sadeghi, Ahmad-Reza. (2024). SoK: A Comprehensive Analysis and Evaluation of Docker Container Attack and Defense Mechanisms. *In Proceedings of the IEEE Symposium on Security and Privacy (SP)*, 4573–4590. https://doi.org/10.1109/sp54263.2024.00268

Jansen, Jacqueline A., Manukyan, Artür, Al Khoury, Nour, & Akalin, Altuna. (2025). Leveraging large language models for data analysis automation. *PLOS ONE*, 20(2), e0317084. https://doi.org/10.1371/journal.pone.0317084

Kohn, Max, Boncz, Peter, & Raasveldt, Mark. (2022). DuckDB-Wasm: Efficient Analytical Query Processing in the Browser. *Proceedings of the VLDB Endowment*, 15(12), 3562-3565. https://doi.org/10.14778/3554821.3554847

Li, Guoliang, Zhou, Xuanhe, & Zhao, Xinyang. (2024). LLM for Data Management. *Proceedings of the VLDB Endowment*, 17(12), 4213–4216. https://doi.org/10.14778/3685800.3685838

Pressman, Roger S. (2015). *Software Engineering: A Practitioner's Approach* (8th ed.). McGraw-Hill Education.

Sarikaya, Alper, Correll, Michael, Bartram, Lyn, Tory, Melanie, & Fisher, Danyel. (2019). What do we talk about when we talk about dashboards? *IEEE Transactions on Visualization and Computer Graphics*, 25(1), 682–692. https://doi.org/10.1109/tvcg.2018.2864903

Schick, Timo, Dwivedi-Yu, Jane, Dessì, Roberto, Raileanu, Roberta, Lomeli, Maria, Zettlemoyer, Luke, Cancedda, Nicola, & Scialom, Thomas. (2023). Toolformer: Language Models Can Teach Themselves to Use Tools. *Transactions of the Association for Computational Linguistics*, 11, 910–924. https://doi.org/10.1162/tacl_a_00576

Sultan, Shady, Ahmad, Ibrahim, & Dimitriou, Tassos. (2019). Container Security: Issues, Challenges, and the Road Ahead. *IEEE Access*, 7, 52976–52994. https://doi.org/10.1109/ACCESS.2019.2911732

Sumers, Ted, Yao, Shunyu, Narasimhan, Karthik, & Griffiths, Thomas L. (2024). Cognitive Architectures for Language Agents. *Transactions on Machine Learning Research*. https://doi.org/10.48550/arXiv.2309.02427

Vanesha, Nellya Anggun. (2024). Comparison Between Usability and User Acceptance Testing on Educational Game Assessment. *Jurnal Sisfokom (Sistem Informasi dan Komputer)*, 13(2), 210–215. https://doi.org/10.32736/sisfokom.v13i2.2099

Wickham, Hadley, Çetinkaya-Rundel, Mine, & Grolemund, Garrett. (2023). *R for Data Science* (2nd ed.). O'Reilly Media.

Wong, Ann Yi, Chekole, Eyasu Getahun, Ochoa, Martín, & Zhou, Jianying. (2023). On the Security of Containers: Threat Modeling, Attack Analysis, and Mitigation Strategies. *Computers & Security*, 128, 103138. https://doi.org/10.1016/j.cose.2023.103138

Xi, Zhiheng, Chen, Wenxiang, Guo, Xin, He, Wei, Ding, Yiwen, Hong, Boyang, Zhang, Mai, Wang, Junzhe, Jin, Senjie, Zhou, Enyu, Zheng, Rui, Fan, Xiaoran, Wang, Xiao, Xiong, Limao, Zhou, Yuhao, Wang, Weiran, Jiang, Changhao, Zou, Yanchao, Liu, Xiangyang, Yin, Zhangyue, Dou, Shihan, Weng, Rongxiang, Cheng, Wensen, Zhang, Qi, Qin, Wenjian, Zheng, Yuyao, Qiu, Xipeng, Huang, Xuanjing, & Gui, Tao. (2025). The rise and potential of large language model based agents: a survey. *Science China Information Sciences*, 68(2), 121101. https://doi.org/10.1007/s11432-024-4222-0

Yao, Shunyu, Zhao, Jeffrey, Yu, Dian, Du, Nan, Shafran, Izhak, Narasimhan, Karthik, & Cao, Yuan. (2023). ReAct: Synergizing Reasoning and Acting in Language Models. *In Proceedings of the International Conference on Learning Representations (ICLR 2023)*. https://doi.org/10.48550/arXiv.2210.03629
