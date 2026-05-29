# BAB I

# PENDAHULUAN

## 1.1 Latar Belakang

Dalam era transformasi digital saat ini, volume data yang dihasilkan oleh berbagai sektor industri telah berkembang secara eksponensial. Data diakui sebagai salah satu aset paling berharga yang dapat dimanfaatkan untuk pengambilan keputusan bisnis, pemahaman tren pasar, dan optimalisasi efisiensi operasional (Provost & Fawcett, 2013). Namun, pertumbuhan volume dan kompleksitas data yang pesat sering kali tidak sebanding dengan ketersediaan analis data (_data analyst_) yang terampil. Proses analisis seperti _Exploratory Data Analysis_ (EDA), _data cleaning_, hingga visualisasi masih membutuhkan banyak intervensi manusia dan waktu yang tidak sedikit, sehingga menjadi hambatan bagi pengguna dengan latar belakang non-teknis.

Upaya otomatisasi proses analitik sebelumnya telah banyak diimplementasikan melalui alat _Automated Exploratory Data Analysis_ (AutoEDA) konvensional seperti _Pandas Profiling_ dan _Sweetviz_ yang telah banyak digunakan untuk membantu proses analisis data awal secara otomatis. Meskipun alat-alat tersebut cukup membantu, terdapat beberapa kelemahan signifikan. Kelemahan utamanya adalah sifat hasil analisis yang statis (_static dashboard_), tidak mampu menjawab pertanyaan spesifik pengguna, dan kurang adaptif terhadap permintaan wawasan kontekstual layaknya berdiskusi dengan analis data sesungguhnya. Selain itu, pendekatan berbasis _single-agent_ pada _Large Language Models_ (LLM) yang mulai digunakan dalam analisis data juga masih menghadapi berbagai kendala, seperti halusinasi pada kode yang dihasilkan, ketidakstabilan saat terjadi _error_ eksekusi, serta alur penalaran analisis yang kurang tervalidasi (Hong et al., 2024).

Berdasarkan penelitian sebelumnya, penggunaan LLM dalam sistem analisis otomatis masih menghadapi tantangan dalam hal konsistensi dan keandalan hasil. Penelitian oleh Sankaranarayanan et al. (2025) menunjukkan bahwa sistem _multi-agent_ berbasis LLM mampu mengotomatisasi proses analisis secara lebih konsisten dan transparan dibandingkan pendekatan _single-agent_, di mana setiap agen menangani tahap spesifik dalam alur kerja analisis sehingga dapat meminimalkan inkonsistensi _output_. Sementara itu, Hong et al. (2024) menjelaskan bahwa agen berbasis LLM memiliki kemampuan untuk membantu proses analisis data dan interpretasi hasil secara otomatis, meskipun masih terdapat tantangan seperti halusinasi kode dan kestabilan eksekusi.

Pendekatan _multi-agent system_ memungkinkan pembagian tugas secara spesifik antar agen, seperti perencanaan analisis, eksekusi kode, dan evaluasi hasil. Hal ini menyerupai kolaborasi tim analis data dalam dunia nyata sehingga mampu meningkatkan akurasi, transparansi, dan efisiensi proses analisis. Tantangan lain yang belum banyak ditangani adalah **ambiguitas niat pengguna** (_user intent ambiguity_), di mana permintaan seperti "analisis data ini" dapat memiliki banyak interpretasi. Pendekatan _Human-in-the-Loop_ (HITL) melalui mekanisme _clarification questions_ telah terbukti meningkatkan akurasi respons pada sistem dialog, namun masih jarang diintegrasikan secara terstruktur ke dalam arsitektur agen analisis data (Aliannejadi et al., 2019).

Oleh karena itu, penelitian ini mengusulkan pengembangan platform _automated data analysis_ berbasis arsitektur _multi-agent_ menggunakan _framework_ LangGraph dan _Large Language Models_ (LLM). Platform ini dirancang untuk mengatasi keterbatasan sistem sebelumnya dengan menghadirkan analisis data yang lebih interaktif, adaptif, dan mampu memberikan _insight_ secara kontekstual melalui interaksi bahasa alami. Arsitektur yang diusulkan mencakup _Intent Agent_ untuk mengidentifikasi tujuan pengguna dan mengajukan pertanyaan klarifikasi bila permintaan bersifat ambigu, _Planner Agent_ untuk merancang alur analisis, _Executor Agent_ untuk menjalankan kode Python secara aman di lingkungan terisolasi, dan _Critic Agent_ untuk memvalidasi hasil. Dengan demikian, diharapkan platform ini dapat membantu pengguna, termasuk yang tidak memiliki latar belakang teknis, dalam melakukan analisis data secara efisien dan akurat.

## 1.2 Ruang Lingkup

Agar target bahasan dalam penelitian dan perancangan platform tetap terarah dan terfokus, penulis menetapkan beberapa ruang lingkup serta batasan penggunaan sebagai berikut:

1. **Fungsi Utama Sistem:** Sistem difokuskan pada proses _Exploratory Data Analysis_ (EDA), prapemrosesan data (_data cleaning_ dan manipulasi data dasar), komputasi penemuan wawasan, dan pembuatan visualisasi data. Sistem **tidak** mencakup fungsi pemodelan _Machine Learning_ prediktif (AutoML).
2. **Arsitektur Agen AI:** Sistem menggunakan _framework Multi-Agent_ berbasis **LangGraph** yang mencakup empat peran fungsional, yaitu _Intent Agent_ untuk memahami dan mengklarifikasi niat pengguna, _Planner Agent_ untuk merancang alur analisis, _Executor Agent_ untuk menjalankan kode secara terisolasi, dan _Critic Agent_ untuk memvalidasi hasil.
3. **Batasan Format Input Data:** Dataset yang dapat dianalisis oleh sistem dibatasi pada format tabular _Comma-Separated Values_ (CSV).
4. **Metode dan Tools Pendukung:** Model penalaran utama menggunakan _Large Language Models_ (LLM) melalui antarmuka _Application Programming Interface_ (API). Antarmuka pengguna (_frontend_) dibangun menggunakan pustaka _React.js_, sedangkan peladen (_backend_) menggunakan _framework_ FastAPI berbasis Python. Lingkungan eksekusi kode Python (_sandbox_) diisolasi untuk menjaga keamanan sistem utama.

## 1.3 Tujuan Penelitian

Berdasarkan latar belakang yang telah diuraikan, penelitian ini bertujuan untuk merancang dan membangun sebuah platform _automated data analysis_ berbasis web yang mampu melakukan proses _Exploratory Data Analysis_ (EDA) serta visualisasi data secara otomatis dengan memanfaatkan arsitektur _Multi-Agent_ berbasis LangGraph dan _Large Language Models_ (LLM). Melalui penerapan arsitektur ini, sistem dikembangkan dengan pembagian peran agen yang spesifik, yaitu _Intent Agent_, _Planner Agent_, _Executor Agent_, dan _Critic Agent_, guna meningkatkan keandalan, konsistensi, serta akurasi dalam proses analisis data.

Selain itu, penelitian ini juga bertujuan untuk menghasilkan sistem yang mampu memberikan _insight_ data secara interaktif melalui input berbasis bahasa alami (_natural language_), sehingga dapat digunakan oleh pengguna non-teknis secara lebih mudah dan efisien. Penelitian ini juga mencakup evaluasi terhadap kinerja sistem dalam meminimalisir kesalahan eksekusi serta meningkatkan kualitas hasil analisis dibandingkan dengan pendekatan _single-agent_.

Dengan tercapainya tujuan tersebut, penelitian ini diharapkan dapat menghasilkan sebuah platform analisis data otomatis yang inovatif, adaptif, dan interaktif dalam membantu pengguna memahami data secara lebih efektif. Sistem yang dikembangkan diharapkan mampu meningkatkan efisiensi proses analisis data, memperluas akses penggunaan teknologi analisis data bagi pengguna non-teknis, serta menjadi referensi dalam pengembangan sistem berbasis _multi-agent_ dan LLM di masa depan, baik di lingkungan akademisi maupun industri.

## 1.4 Sistematika Penulisan

Agar penelitian dapat dipahami dengan alur yang baik, penyusunan naskah skripsi ini diuraikan ke dalam susunan bab yang saling berkelanjutan. Karya ilmiah ini dimulai dari Bab Pertama (Bab I) yang menyusun pendahuluan dasar. Pada bab ini dipaparkan landasan pikiran mengenai urgensi pengkajian masalah, penetapan ruang lingkup serta batasan operasional penelitian, penjelasan target tujuan yang ingin dicapai, serta skema keseluruhan susunan laporan.

Setelah landasan umum dipahami dengan jelas, naskah beralih ke Bab Dua (Bab II) yang menjabarkan tinjauan pustaka serta kerangka teoritis literatur pendukung. Bab ini menyajikan telaah terhadap sistem analisis data terdahulu serta kajian teori mengenai _Multi-Agent System_, LangGraph, _Large Language Models_ (LLM), _Exploratory Data Analysis_ (EDA), serta konsep dasar pengembangan aplikasi web.

Selanjutnya, alur kerja struktural maupun proses implementasi penelitian dirincikan secara eksplisit pada Bab Tiga (Bab III). Bab yang menitikberatkan pada metodologi penelitian ini menaungi fase perancangan sistem secara menyeluruh. Topologi desain diagram alir (_flowchart_), tatanan arsitektur _Multi-Agent_, serta rancangan antarmuka _frontend_ dan _backend_ disajikan seluruhnya pada bab pertengahan ini.

Setelah kerangka diramu, prosedur teknis pelaksanaan dan pengujian implementasi dipaparkan pada Bab Empat (Bab IV). Bab implementasi ini menyajikan diskursus konkrit kinerja hasil uji sistem secara teknis. Kelancaran respons kolaborasi antar agen, analisis performa komputasi, serta tampilan antarmuka sistem ditampilkan di bagian ini sejalan dengan penyajian hasil evaluasi eksperimen yang dilaksanakan.

Penyusunan naskah diakhiri melalui Bab Lima (Bab V) yang memuat kesimpulan dan saran. Bab ini merangkum intisari akhir mengenai sejauh mana platform yang dikembangkan mampu memenuhi rumusan masalah penelitian beserta implikasi kegunaannya. Selain itu, pandangan pengembangan lebih lanjut disertakan sebagai rekomendasi bagi penelitian di kemudian hari.

---

## Daftar Pustaka Bab I

Aliannejadi, M., Zamani, H., Crestani, F., & Croft, W. B. (2019). Asking Clarifying Questions in Open-Domain Information-Seeking Conversations. In _Proceedings of the 42nd International ACM SIGIR Conference on Research and Development in Information Retrieval_ (SIGIR '19), 475–484.

Hong, R., et al. (2024). _Data Interpreter: An LLM Agent for Data Science_. arXiv preprint arXiv:2402.18679.

Provost, F., & Fawcett, T. (2013). _Data Science for Business: What You Need to Know about Data Mining and Data-Analytic Thinking_. O'Reilly Media.

Sankaranarayanan, S., Borchers, C., Simon, S., Tajik, E., Ataş, A. H., Çelik, B., & Balzan, F. (2025). Automating Thematic Analysis with Multi-Agent LLM Systems. _CEUR Workshop Proceedings_, Vol-3995.
