# BAB II

# TINJAUAN PUSTAKA

## 2.1 Penelitian Terdahulu

Sejumlah penelitian sebelumnya telah mengeksplorasi penerapan kecerdasan buatan dan otomatisasi dalam proses analisis data. Tinjauan terhadap penelitian-penelitian tersebut menjadi dasar untuk memahami perkembangan, celah (_gap_), dan kontribusi yang dapat diberikan oleh penelitian ini.

Hong et al. (2024) dalam penelitiannya yang berjudul _"Data Interpreter: An LLM Agent for Data Science"_ memperkenalkan sebuah agen berbasis LLM yang mampu menyelesaikan tugas-tugas ilmu data (_data science_) secara end-to-end melalui eksekusi kode iteratif. Sistem ini menunjukkan kemampuan luar biasa dalam menginterpretasikan data secara dinamis, namun masih beroperasi pada pendekatan _single-agent_ sehingga alur validasi hasil eksekusinya terbatas (Hong et al., 2024).

Zhang et al. (2024) mengusulkan sistem _"TaskBench: Benchmarking Large Language Models for Task Automation"_ yang mengevaluasi kemampuan LLM dalam memecah tugas kompleks menjadi sub-tugas yang dapat dieksekusi secara otomatis. Penelitian ini relevan sebagai dasar evaluasi kemampuan dekomposisi tugas pada sistem _Planner Agent_ yang dirancang dalam penelitian ini (Zhang et al., 2024).

Zhao et al. (2023) dalam _"A Survey of Large Language Models"_ memberikan tinjauan komprehensif tentang perkembangan LLM dari GPT-3 hingga model-model mutakhir, termasuk kemampuan _few-shot learning_, _instruction following_, dan keterbatasannya dalam penalaran kompleks. Penelitian ini menjadi fondasi pemahaman tentang kapabilitas dan limitasi LLM yang digunakan dalam sistem ini (Zhao et al., 2023).

Alat AutoEDA konvensional seperti _Pandas Profiling_ (kini _ydata-profiling_) dan _Sweetviz_ menyediakan laporan HTML yang komprehensif secara otomatis. Meskipun demikian, alat-alat tersebut menghasilkan laporan yang bersifat statis dan tidak dapat merespons pertanyaan analitik spesifik dari pengguna secara dinamis.

**[GAMBAR: Figure 2.1 — Contoh output AutoEDA (histogram, boxplot, heatmap).]**

Guo et al. (2024) dalam _"Exploring LLM Multi-Agent Application Implementation Based on LangGraph+CrewAI"_ (arXiv:2411.18241) membahas desain arsitektur _multi-agent_ menggunakan LangGraph untuk berbagai domain aplikasi. Penelitian ini menunjukkan keunggulan alur berbasis graf dalam mengelola komunikasi antar agen secara terstruktur dan efisien (Guo et al., 2024).

Berdasarkan tinjauan penelitian-penelitian di atas, terdapat kesamaan topik pada pemanfaatan LLM dan arsitektur agen untuk otomatisasi tugas. Namun, penelitian-penelitian tersebut belum secara spesifik mengintegrasikan ketiganya—arsitektur _multi-agent_ terstruktur, eksekusi kode terisolasi (_sandbox_), dan validasi empiris oleh _Critic Agent_—dalam satu platform analisis data interaktif berbasis web yang dapat digunakan oleh pengguna non-teknis. Tabel 2.1 merangkum perbandingan penelitian terdahulu dengan penelitian ini.

**Tabel 2.1 Perbandingan Penelitian Terdahulu**

| No  | Peneliti                  | Tahun    | Metode/Sistem                        | Kelebihan                                                                                                | Kekurangan                                               |
| --- | ------------------------- | -------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | Hong et al.               | 2024     | Data Interpreter (LLM Agent)         | Eksekusi kode iteratif end-to-end                                                                        | Single-agent, tanpa validasi terstruktur                 |
| 2   | Zhang et al.              | 2024     | TaskBench                            | Evaluasi dekomposisi tugas LLM                                                                           | Tidak fokus pada analisis data                           |
| 3   | Zhao et al.               | 2023     | Survey LLM                           | Kajian mendalam kapabilitas LLM                                                                          | Bukan sistem implementasi                                |
| 4   | Alat AutoEDA Konvensional | -        | Pandas Profiling / Sweetviz          | Laporan otomatis yang komprehensif                                                                       | Bersifat statis dan kurang adaptif terhadap bahasa alami |
| 5   | Guo et al.                | 2024     | LangGraph+CrewAI                     | Multi-agent berbasis graf terstruktur                                                                    | Tidak untuk platform analisis data                       |
| 6   | **Penelitian Ini**        | **2025** | **Multi-Agent Platform (LangGraph)** | **Integrasi Intent, Planner, Executor, Critic + mekanisme klarifikasi (HITL) + sandbox + web interface** | -                                                        |

---

## 2.2 Landasan Teori

### 2.2.1 Data dan Analisis Data

Data merupakan kumpulan fakta, angka, atau simbol yang merepresentasikan informasi mentah yang belum diinterpretasikan (Provost & Fawcett, 2013). Dalam konteks ilmu data (_data science_), analisis data didefinisikan sebagai proses sistematis untuk memeriksa, membersihkan, mentransformasi, dan memodelkan data dengan tujuan untuk menemukan informasi yang berguna, membuat kesimpulan, dan mendukung pengambilan keputusan (Han et al., 2022).

Proses analisis data umumnya terdiri dari beberapa tahapan utama:

1. **Pengumpulan Data (_Data Collection_):** Proses perolehan data dari berbagai sumber.
2. **Prapemrosesan Data (_Data Preprocessing_):** Proses membersihkan, menangani nilai yang hilang (_missing values_), dan menormalkan data agar siap dianalisis.
3. **Eksplorasi Data (_Exploratory Data Analysis_):** Proses investigasi awal untuk memahami karakteristik dan pola dalam data.
4. **Analisis dan Pemodelan:** Proses penerapan metode statistik atau _machine learning_ untuk mengekstraksi wawasan.
5. **Visualisasi dan Pelaporan:** Penyajian hasil dalam bentuk grafik, tabel, atau laporan yang mudah dipahami.

### 2.2.2 Exploratory Data Analysis (EDA)

_Exploratory Data Analysis_ (EDA) adalah pendekatan untuk menganalisis dataset guna merangkum karakteristik utamanya, sering kali menggunakan metode visual, sebelum pemodelan formal dilakukan (Tukey, 1977). Konsep EDA pertama kali diperkenalkan oleh John W. Tukey pada tahun 1977 dan seiring waktu menjadi tahap kritis dalam setiap alur kerja analisis data modern.

Teknik-teknik utama dalam EDA meliputi:

- **Statistik Deskriptif:** Perhitungan nilai rata-rata (_mean_), median, standar deviasi, dan kuartil untuk memahami distribusi data.
- **Analisis Distribusi:** Penggunaan histogram dan _density plot_ untuk memvisualisasikan sebaran nilai variabel.
- **Analisis Korelasi:** Penggunaan _heatmap_ korelasi untuk mengidentifikasi hubungan antar variabel.
- **Deteksi Anomali:** Identifikasi _outlier_ atau nilai ekstrem menggunakan _boxplot_ atau metode statistik seperti _z-score_ dan IQR.
- **Analisis Nilai Hilang (_Missing Value Analysis_):** Pemetaan dan penanganan data yang tidak lengkap.

Alat AutoEDA konvensional seperti _Pandas Profiling_ (kini _ydata-profiling_) dan _Sweetviz_ menyediakan laporan HTML yang komprehensif secara otomatis. Meskipun demikian, alat-alat tersebut menghasilkan laporan yang bersifat statis dan tidak dapat merespons pertanyaan analitik spesifik dari pengguna secara dinamis.

### 2.2.3 Large Language Models (LLM)

_Large Language Models_ (LLM) adalah model kecerdasan buatan berbasis _deep learning_ yang dilatih pada korpus teks berukuran sangat besar menggunakan arsitektur _Transformer_ (Zhao et al., 2023). LLM mampu memahami dan menghasilkan teks dalam bahasa alami, menulis kode, serta menalar tugas-tugas kompleks melalui mekanisme _attention_ yang memungkinkan model untuk memahami konteks kalimat secara menyeluruh.

Perkembangan LLM mengalami lompatan signifikan dengan diperkenalkannya model GPT-3 oleh OpenAI pada tahun 2020, yang kemudian dilanjutkan dengan GPT-4 pada 2023 yang memiliki kemampuan multimodal dan penalaran yang jauh lebih baik (OpenAI, 2023). Karakteristik utama LLM modern meliputi:

- **Pemahaman Bahasa Alami (_Natural Language Understanding/NLU_):** Kemampuan memahami instruksi dan konteks yang diberikan pengguna dalam bahasa sehari-hari.
- **Generasi Kode (_Code Generation_):** Kemampuan menulis, menganalisis, dan memperbaiki kode dalam berbagai bahasa pemrograman, termasuk Python.
- **Penalaran Berantai (_Chain-of-Thought Reasoning_):** Kemampuan memecah masalah kompleks menjadi langkah-langkah logis yang berurutan.
- **Kemampuan _Few-Shot Learning_:** Kemampuan beradaptasi dengan tugas baru hanya dengan beberapa contoh yang diberikan dalam prompt.

Namun, LLM juga memiliki kelemahan mendasar berupa **halusinasi** (_hallucination_), yaitu kecenderungan model untuk menghasilkan teks atau kode yang terlihat meyakinkan namun faktanya salah atau tidak valid (Huang et al., 2023). Huang et al. (2023) dalam surveynya mengklasifikasikan halusinasi LLM ke dalam dua kategori utama: _factuality hallucination_ (konflik dengan fakta dunia nyata) dan _faithfulness hallucination_ (konflik dengan konteks yang diberikan). Fenomena ini menjadi salah satu motivasi utama penggunaan arsitektur _multi-agent_ dengan mekanisme validasi dalam penelitian ini.

### 2.2.4 Multi-Agent System (MAS)

_Multi-Agent System_ (MAS) adalah sistem yang terdiri dari sekumpulan agen otonom yang berinteraksi satu sama lain di dalam suatu lingkungan bersama untuk mencapai tujuan tertentu (Wooldridge & Jennings, 1995). Wooldridge dan Jennings (1995) mendefinisikan agen sebagai sistem komputer yang bersifat otonom, reaktif, proaktif, dan memiliki kemampuan sosial untuk berinteraksi dengan agen lain.

**[GAMBAR: Figure 2.2 — Skematik Multi-Agent System (agen + interaksi).]**

Dalam konteks LLM, agen AI merupakan sistem yang menggunakan LLM sebagai "otak" utamanya, dilengkapi dengan kemampuan untuk menggunakan _tools_ (alat), mengakses memori, dan merencanakan serangkaian tindakan untuk mencapai suatu tujuan secara mandiri. Karakteristik utama agen berbasis LLM meliputi:

1. **Perencanaan (_Planning_):** Kemampuan untuk membuat rencana tindakan bertahap dalam merespons perintah pengguna.
2. **Penggunaan Alat (_Tool Use_):** Kemampuan untuk memanggil fungsi atau API eksternal seperti pencarian web, eksekutor kode, atau basis data.
3. **Memori (_Memory_):** Kemampuan untuk menyimpan dan mengakses informasi dari interaksi sebelumnya (_conversational memory_ dan _long-term memory_).
4. **Refleksi (_Reflection_):** Kemampuan untuk mengevaluasi hasil tindakannya sendiri dan melakukan koreksi jika diperlukan.

Keunggulan arsitektur MAS dibandingkan _single-agent_ terletak pada kemampuan dekomposisi masalah yang lebih baik, paralelisasi tugas, dan spesialisasi peran yang memungkinkan setiap agen fokus pada kompetensi spesifiknya. Wang et al. (2024) dalam _"A Survey on Large Language Model based Autonomous Agents"_ menunjukkan bahwa sistem multi-agen secara konsisten menghasilkan performa yang lebih baik dibandingkan agen tunggal pada tugas-tugas yang membutuhkan penalaran berlapis (Wang et al., 2024).

### 2.2.5 LangGraph

LangGraph adalah _framework_ sumber terbuka (_open-source_) yang dikembangkan oleh LangChain untuk membangun aplikasi multi-agen berbasis LLM yang _stateful_ (memiliki status). LangGraph dirilis pada awal tahun 2024 sebagai jawaban atas kebutuhan alur kerja yang lebih kompleks, terkontrol, dan siklus (_cyclic_) yang tidak dapat direpresentasikan dengan model eksekusi linier (Guo et al., 2024).

Konsep inti LangGraph didasarkan pada teori graf berarah (_directed graph_), di mana:

- **Node (Simpul):** Merepresentasikan fungsi atau agen yang menjalankan suatu tugas.
- **Edge (Sisi/Tepi):** Merepresentasikan alur transisi status antar simpul.
- **State (Status):** Objek berbagi yang diperbarui oleh setiap simpul dan diteruskan ke seluruh graf sebagai memori bersama.

Keunggulan utama LangGraph dibandingkan pendekatan lainnya adalah kemampuannya dalam mengelola **siklus (_cycles_)** di dalam alur kerja, yang memungkinkan implementasi mekanisme iterasi seperti _retry on error_ dan _critic-refine loop_. Selain itu, LangGraph menyediakan dukungan bawaan untuk _persistence_ status, _human-in-the-loop_, dan _streaming_ output, yang sangat penting untuk pengalaman pengguna yang responsif pada aplikasi web (Guo et al., 2024).

**[GAMBAR: Figure 2.3 — Ilustrasi konsep LangGraph: node, edge, dan state bersama.]**

Dalam penelitian ini, LangGraph digunakan untuk mengorkestrasikan alur kerja empat agen: _Intent Agent_ → _Planner Agent_ → _Executor Agent_ → _Critic Agent_, di mana _Intent Agent_ dapat menangguhkan _pipeline_ untuk dialog klarifikasi, dan _Critic Agent_ dapat memicu siklus perbaikan (_refinement loop_) secara kondisional berdasarkan evaluasi kualitas hasil.

### 2.2.6 Arsitektur Intent-Planner-Executor-Critic

Pola arsitektur berlapis yang dikenal sebagai _Planner-Executor-Critic_ merupakan salah satu pola desain _multi-agent_ yang paling umum digunakan untuk tugas-tugas yang membutuhkan perencanaan, eksekusi kode, dan validasi hasil (Hong et al., 2024). Penelitian ini memperluas pola tersebut dengan menambahkan satu agen di hulu (_upstream_), yaitu _Intent Agent_, yang berfungsi memahami niat pengguna sebelum proses perencanaan dimulai. Perluasan ini didorong oleh temuan bahwa kegagalan sistem agen tidak hanya terjadi pada tahap eksekusi kode, tetapi juga pada tahap interpretasi permintaan yang ambigu (Mosqueira-Rey et al., 2023). Setiap agen dalam sistem yang diusulkan memiliki peran yang terdefinisi dengan jelas:

1. **Intent Agent:** Bertanggung jawab menganalisis permintaan pengguna untuk menentukan niat (_intent_) yang dikandungnya (misalnya _EDA_, _visualization_, _preprocessing_, _machine learning_), menilai tingkat keyakinan (_confidence_), dan menuliskan ulang pertanyaan (_rewritten query_) ke dalam bentuk yang lebih eksplisit. Apabila niat dinilai ambigu, _Intent Agent_ menghasilkan pertanyaan klarifikasi (_clarification questions_) yang dikirim ke pengguna melalui antarmuka, sehingga _pipeline_ tidak dilanjutkan ke _Planner Agent_ sampai pengguna memberi jawaban. Mekanisme ini mengadopsi prinsip _Human-in-the-Loop_ (HITL) yang diuraikan pada Subbab 2.2.9.

2. **Planner Agent:** Bertanggung jawab menerima permintaan pengguna (atau _rewritten query_ dari _Intent Agent_) beserta konteks dataset, kemudian menghasilkan rencana (_plan_) berupa daftar tugas terurut yang perlu dieksekusi. _Planner_ menggunakan kemampuan penalaran LLM untuk mendekomposisi pertanyaan menjadi sub-tugas yang dapat dieksekusi oleh _Executor_.

3. **Executor Agent:** Bertanggung jawab menjalankan setiap sub-tugas yang ditetapkan oleh _Planner_. Eksekutor dilengkapi dengan serangkaian _tools_ seperti _Python REPL_, _data profiling tool_, _chart rendering tool_, dan _web search tool_. Jika terjadi _error_ pada eksekusi kode, _Executor_ secara otomatis melakukan _debugging_ dan mencoba ulang.

4. **Critic Agent:** Bertanggung jawab mengevaluasi keseluruhan hasil yang dihasilkan oleh _Executor_ dan memberikan penilaian (_judgment_) apakah hasil tersebut sudah memenuhi permintaan pengguna. Jika belum, _Critic_ menghasilkan daftar tugas perbaikan (_additional tasks_) yang kemudian dieksekusi ulang oleh _Executor_ dalam satu putaran perbaikan (_one-shot refinement_).

Penambahan _Intent Agent_ di hulu _pipeline_ memungkinkan pemisahan tanggung jawab (_separation of concerns_) yang lebih bersih: _Planner_ dapat berfokus penuh pada dekomposisi tugas tanpa perlu menangani ketidakjelasan permintaan, sementara _Intent Agent_ dioptimasi khusus untuk pemahaman linguistik dan dialog klarifikasi. Secara keseluruhan, pola empat-agen ini meningkatkan konsistensi dan keandalan hasil dibandingkan dengan pendekatan _single-agent_ karena adanya mekanisme pemahaman niat, pengawasan (_oversight_), dan koreksi otomatis yang terstruktur.

**Gambar 2.4 — Arsitektur Intent → Planner → Executor → Critic**

```mermaid
flowchart TD
		U[Pengguna] --> CLASS{Classifier}
		CLASS -- "smalltalk" --> SMALL[Direct LLM\n(Jawab langsung)]
		CLASS -- "data_task" --> INTENT[Intent Agent\n(MODEL_INTENT)]

		INTENT --> AMBIG{Ambigu?}
		AMBIG -- "Ya" --> CLAR[Clarification\n(Multi-choice ≤ 3)]
		CLAR --> WAIT[User jawab (HITL)]
		WAIT --> PLAN[Planner Agent\n(MODEL_PLANNER)]
		AMBIG -- "Tidak" --> PLAN

		PLAN --> EXEC[Executor Agent\n(MODEL_EXECUTOR)]

		subgraph Tools[Available Tools]
			T1[🔎 read_data_tool]
			T2[🐍 python_repl_tool]
			T3[📈 render_chart_tool]
			T4[📊 data_profile_tool]
		end

		EXEC --> T1 & T2 & T3 & T4
		T2 & T3 & T4 --> SBX[Docker Sandbox\n(terisolasi)]

		EXEC --> CRITIC[Critic Agent\n(MODEL_CRITIC)]
		CRITIC --> JUDGE{Judgment?}
		JUDGE -- "ok" --> OUTPUT[Output ke Pengguna\n(via SSE)]
		JUDGE -- "refine" --> REFINE[Refinement\n(max 2 tasks)] --> EXEC

		style U fill:#3b82f6,stroke:#60a5fa,color:#ffffff
		style CLASS fill:#f59e0b,stroke:#fbbf24,color:#000000
		style INTENT fill:#0ea5e9,stroke:#38bdf8,color:#ffffff
		style PLAN fill:#8b5cf6,stroke:#a78bfa,color:#ffffff
		style EXEC fill:#6366f1,stroke:#818cf8,color:#ffffff
		style CRITIC fill:#ec4899,stroke:#f472b6,color:#ffffff
		style OUTPUT fill:#10b981,stroke:#34d399,color:#ffffff
		style SBX fill:#1e3a5f,stroke:#3b82f6,color:#ffffff
```

### 2.2.7 Eksekusi Kode Terisolasi (Code Sandbox)

Eksekusi kode yang dihasilkan oleh LLM secara langsung pada sistem produksi menimbulkan risiko keamanan yang serius, termasuk eksekusi kode berbahaya, akses tidak sah ke _file system_, dan konsumsi sumber daya yang tidak terkontrol (Merkel, 2014). Oleh karena itu, diperlukan mekanisme _sandbox_, yaitu lingkungan eksekusi yang terisolasi dan dibatasi.

Dalam penelitian ini, isolasi lingkungan eksekusi Python dicapai menggunakan teknologi **kontainerisasi Docker**. Docker merupakan platform _containerization_ yang memungkinkan pembuatan lingkungan terisolasi (_container_) yang lengkap dengan dependensi yang diperlukan, namun terpisah dari sistem host (Burns et al., 2022). Setiap eksekusi kode dari _Executor Agent_ dijalankan di dalam _container_ Docker yang terpisah, sehingga potensi dampak dari kode berbahaya atau _error_ dapat dibatasi hingga lingkup _container_ saja tanpa mempengaruhi sistem utama.

**Gambar 2.5 — Diagram Sandbox/Container untuk Eksekusi Kode Terisolasi**

```mermaid
flowchart LR
		EA[Executor Agent\n(menghasilkan kode Python)] --> WRITE[Tulis kode ke _exec_script.py]
		WRITE --> CREATE[Buat Docker Container\n• image: ai-sandbox\n• network_disabled: true\n• mem_limit: 512MB\n• cpu_quota: 100000]
		CREATE --> MOUNT[Mount volume: data_folder → /app/data]
		MOUNT --> RUN[Jalankan: python /app/data/_exec_script.py]
		RUN --> WATCH{Watchdog\nTimeout > 120s?}
		WATCH -- "Ya" --> KILL[Kill Container\nReturn Error]
		WATCH -- "Tidak" --> STREAM[Stream Output\n(line-by-line via SSE)]
		STREAM --> CLEAN[Remove Container\nHapus _exec_script.py & tmp files]
		KILL --> CLEAN

		subgraph SandboxConfig[Parameter Keamanan Sandbox]
			N[network_disabled: true]
			MEM[mem_limit: 512MB]
			CPU[cpu_quota: 100000]
			TIMEOUT[timeout: 120s]
		end

		CREATE --- SandboxConfig

		style EA fill:#8b5cf6,stroke:#a78bfa,color:#ffffff
		style WRITE fill:#60a5fa,stroke:#93c5fd,color:#ffffff
		style CREATE fill:#6366f1,stroke:#818cf8,color:#ffffff
		style MOUNT fill:#3b82f6,stroke:#60a5fa,color:#ffffff
		style RUN fill:#10b981,stroke:#34d399,color:#ffffff
		style WATCH fill:#f59e0b,stroke:#fbbf24,color:#000000
		style KILL fill:#ef4444,stroke:#f87171,color:#ffffff
		style STREAM fill:#06b6d4,stroke:#67e8f9,color:#000000
		style CLEAN fill:#374151,stroke:#9ca3af,color:#ffffff
		style SandboxConfig fill:#1f2937,stroke:#4b5563,color:#ffffff
```

### 2.2.8 Pengembangan Aplikasi Web Modern

Pengembangan platform analisis data berbasis web dalam penelitian ini mengadopsi arsitektur **decoupled** (terpisah) antara _frontend_ dan _backend_, yang merupakan pola umum pada pengembangan aplikasi web modern dan didukung oleh dokumentasi resmi React dan FastAPI.

**Frontend — React.js**

React.js adalah pustaka JavaScript _open-source_ yang dikembangkan oleh Meta (Facebook) untuk membangun antarmuka pengguna yang interaktif dan berbasis komponen (_component-based_). React menggunakan paradigma _declarative programming_ di mana pengembang mendefinisikan tampilan berdasarkan status aplikasi, dan React secara otomatis memperbarui _Document Object Model_ (DOM) yang efisien menggunakan mekanisme _Virtual DOM_. Karakteristik utama React yang dimanfaatkan dalam penelitian ini meliputi:

- **Component-Based Architecture:** Memungkinkan pembuatan antarmuka yang modular dan dapat digunakan kembali (_reusable_).
- **React Hooks:** Memungkinkan pengelolaan status (_state management_) fungsional yang efisien.
- **Server-Sent Events (SSE):** Kemampuan untuk menerima _streaming_ data dari server secara real-time, yang digunakan untuk menampilkan output agen secara progresif.

**Backend — FastAPI**

FastAPI adalah _framework_ web Python berbasis _asynchronous_ yang modern dan berkinerja tinggi untuk membangun API. FastAPI memanfaatkan anotasi tipe Python (_type hints_) dan Pydantic untuk validasi data otomatis serta menghasilkan dokumentasi API interaktif (_OpenAPI/Swagger_) secara otomatis. Dalam penelitian ini, FastAPI berfungsi sebagai inti peladen yang menerima permintaan dari _frontend_, mengelola sesi analisis pengguna, dan meneruskan perintah ke dalam _pipeline_ agen LangGraph.

**Komunikasi Real-Time — Server-Sent Events (SSE)**

Untuk menyampaikan respons agen secara progresif (_streaming_), penelitian ini menggunakan protokol _Server-Sent Events_ (SSE). SSE merupakan standar web yang memungkinkan server mendorong (_push_) pembaruan data ke klien secara satu arah dan berkelanjutan melalui koneksi HTTP yang persisten. Pendekatan ini dipilih karena lebih ringan dibandingkan _WebSocket_ untuk kasus penggunaan _streaming_ teks searah dari server ke klien.

**[GAMBAR: Figure 2.6 — Diagram arsitektur web: Frontend (React) ↔ Backend (FastAPI) dengan SSE streaming.]**

### 2.2.9 Human-in-the-Loop dan Mekanisme Klarifikasi

_Human-in-the-Loop_ (HITL) adalah paradigma perancangan sistem kecerdasan buatan yang secara eksplisit melibatkan intervensi manusia pada titik-titik keputusan krusial dalam alur kerja otomatis (Mosqueira-Rey et al., 2023). Berbeda dengan sistem sepenuhnya otonom yang berusaha meminimalkan campur tangan pengguna, sistem HITL memanfaatkan keahlian dan konteks yang dimiliki manusia untuk meningkatkan kualitas keputusan pada kasus yang ambigu, berisiko tinggi, atau memerlukan preferensi subjektif.

Salah satu wujud HITL yang paling relevan untuk sistem dialog berbasis LLM adalah **mekanisme pertanyaan klarifikasi** (_clarification questions_). Aliannejadi et al. (2019) mendemonstrasikan bahwa pada sistem pencarian informasi berbasis percakapan, pengajuan pertanyaan klarifikasi sebelum memberikan respons dapat meningkatkan akurasi hasil pencarian secara signifikan dibandingkan dengan menebak niat pengguna langsung dari kueri awal. Temuan ini konsisten dengan hasil Rao dan Daumé (2018) yang menunjukkan bahwa kemampuan agen untuk bertanya pada momen yang tepat (_knowing when to ask_) merupakan pembeda utama antara sistem dialog yang berkualitas tinggi dan rendah.

Dalam konteks agen analisis data, permintaan pengguna seringkali memiliki derajat ambiguitas yang tinggi. Sebagai contoh, pertanyaan "buat visualisasi dari data ini" tidak menyebutkan kolom yang diminati, jenis grafik yang diinginkan, maupun variabel pengelompokan. Tanpa klarifikasi, agen harus mengandalkan asumsi implisit yang berpotensi menghasilkan analisis yang tidak relevan dengan kebutuhan pengguna. Karakteristik mekanisme klarifikasi yang efektif meliputi:

**[GAMBAR: Figure 2.7 — Alur Human-in-the-Loop: klarifikasi pengguna → jawaban → perencanaan → eksekusi.]**

1. **Selektif:** Klarifikasi hanya diajukan ketika tingkat keyakinan agen rendah; permintaan yang sudah cukup spesifik tetap diproses tanpa interupsi agar tidak mengorbankan efisiensi interaksi.
2. **Terbatas jumlahnya:** Terlalu banyak pertanyaan dalam satu giliran akan mengikis pengalaman pengguna; penelitian ini membatasi maksimal tiga pertanyaan per giliran klarifikasi.
3. **Terstruktur dengan opsi:** Pertanyaan disajikan dalam bentuk pilihan ganda (_multiple choice_) sehingga pengguna non-teknis tidak perlu merumuskan jawaban bebas, yang mempercepat alur interaksi dan menurunkan beban kognitif.
4. **Satu putaran (_single-round_):** Setelah pengguna memberikan jawaban, agen tidak mengajukan pertanyaan klarifikasi berikutnya dan langsung melanjutkan ke tahap perencanaan, untuk menghindari siklus tanya-jawab yang panjang.

Dalam penelitian ini, prinsip-prinsip HITL tersebut diwujudkan melalui _Intent Agent_ yang menjalankan dialog klarifikasi sebelum _Planner Agent_ memulai dekomposisi tugas, sehingga keputusan mengenai arah analisis senantiasa tetap berada dalam kendali pengguna.

---

## 2.3 Kerangka Pikir

Berdasarkan tinjauan pustaka yang telah diuraikan, dapat disusun kerangka pikir penelitian sebagai berikut. Permasalahan inti yang diidentifikasi adalah ketidakmampuan sistem analisis data konvensional dan pendekatan _single-agent_ untuk memberikan analisis data yang adaptif, andal, dan dapat diakses oleh pengguna non-teknis. Keterbatasan ini mendorong pengembangan platform baru yang mengintegrasikan kemampuan LLM dengan arsitektur _Multi-Agent System_ yang terstruktur melalui LangGraph.

Platform yang dibangun beroperasi dengan menerima masukan berupa _dataset_ CSV dan pertanyaan dalam bahasa alami dari pengguna. _Intent Agent_ terlebih dahulu mengidentifikasi niat pengguna dan, apabila permintaan bersifat ambigu, mengajukan pertanyaan klarifikasi (_Human-in-the-Loop_). Setelah niat teridentifikasi dengan jelas, _Planner Agent_ merancang rencana analisis, _Executor Agent_ menjalankan kode Python di lingkungan _sandbox_ yang aman, dan _Critic Agent_ memvalidasi kualitas hasil sebelum dikembalikan kepada pengguna. Seluruh proses ini ditampilkan secara real-time melalui antarmuka web interaktif yang dibangun menggunakan React.js dan FastAPI.

---

## Daftar Pustaka Bab II

Aliannejadi, M., Zamani, H., Crestani, F., & Croft, W. B. (2019). Asking Clarifying Questions in Open-Domain Information-Seeking Conversations. In _Proceedings of the 42nd International ACM SIGIR Conference on Research and Development in Information Retrieval_ (SIGIR '19), 475–484.

Burns, B., Beda, J., Hightower, K., & Evenson, L. (2022). _Kubernetes: Up and Running_ (3rd ed.). O'Reilly Media.

Guo, T., et al. (2024). _Exploration of LLM Multi-Agent Application Implementation Based on LangGraph+CrewAI_. arXiv preprint arXiv:2411.18241.

Han, J., Pei, J., & Tong, H. (2022). _Data Mining: Concepts and Techniques_ (4th ed.). Morgan Kaufmann.

FastAPI. (n.d.). _FastAPI Documentation_. https://fastapi.tiangolo.com/

Hong, R., et al. (2024). _Data Interpreter: An LLM Agent for Data Science_. arXiv preprint arXiv:2402.18679.

React. (n.d.). _React Documentation_. https://react.dev/

Huang, L., et al. (2023). _A Survey on Hallucination in Large Language Models: Principles, Taxonomy, Challenges, and Open Questions_. arXiv preprint arXiv:2311.05232.

Merkel, D. (2014). Docker: Lightweight Linux Containers for Consistent Development and Deployment. _Linux Journal_, 2014(239), 2.

Mosqueira-Rey, E., Hernández-Pereira, E., Alonso-Ríos, D., Bobes-Bascarán, J., & Fernández-Leal, Á. (2023). Human-in-the-Loop Machine Learning: A State of the Art. _Artificial Intelligence Review_, 56(4), 3005–3054.

OpenAI. (2023). _GPT-4 Technical Report_. arXiv preprint arXiv:2303.08774.

Provost, F., & Fawcett, T. (2013). _Data Science for Business: What You Need to Know about Data Mining and Data-Analytic Thinking_. O'Reilly Media.

Rao, S., & Daumé III, H. (2018). Learning to Ask Good Questions: Ranking Clarification Questions using Neural Expected Value of Perfect Information. In _Proceedings of the 56th Annual Meeting of the Association for Computational Linguistics_ (ACL), 2737–2746.

Tukey, J. W. (1977). _Exploratory Data Analysis_. Addison-Wesley.

Wang, L., et al. (2024). _A Survey on Large Language Model based Autonomous Agents_. _Frontiers of Computer Science_, 18(6), 186345.

Wooldridge, M., & Jennings, N. R. (1995). Intelligent Agents: Theory and Practice. _The Knowledge Engineering Review_, 10(2), 115–152.

Zhang, Y., et al. (2024). _TaskBench: Benchmarking Large Language Models for Task Automation_. arXiv preprint arXiv:2311.18760.

Zhao, W. X., et al. (2023). _A Survey of Large Language Models_. arXiv preprint arXiv:2303.18223.
