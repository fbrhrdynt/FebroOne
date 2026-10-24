# Instalasi Febro One — Ubuntu 24.04

Panduan ini untuk VPS milik Anda, domain **one.febro.id**, IP **161.248.116.14**, direktori **/opt/febro-one**. Perintah belum dijalankan pada VPS Anda. Baca FEATURE_MATRIX.md: aplikasi belum memenuhi seluruh fitur/acceptance PRD. Jangan gunakan sebagai satu-satunya penyimpanan data penting sebelum uji restore berhasil.

## 1. Prasyarat dan pemeriksaan

Siapkan akses SSH pengguna dengan sudo, Ubuntu24.04, ruang kosong minimal3GB (lebih untuk dokumen/backup), RAM minimal2GB disarankan untuk build. DNS A one.febro.id harus menunjuk161.248.116.14. Jika ada AAAA, pastikan benar atau hapus record AAAA yang salah. Jangan mengubah DNS aplikasi lain.

Login melalui SSH (ganti `ubuntu` jika nama user berbeda):

```bash
ssh ubuntu@161.248.116.14
lsb_release -a
df -h
free -h
sudo ss -ltnp
sudo nginx -t
```

Jika Nginx belum dipasang, pemeriksaan terakhir bisa gagal karena command tidak ditemukan. Jangan lanjut konfigurasi jika Nginx yang sudah ada tidak valid. Port3471 harus kosong. Simpan salinan konfigurasi server yang ada sebelum perubahan. Jangan hapus default/site aplikasi lain, jangan restart PostgreSQL jika sudah melayani aplikasi lain, dan jangan mengubah firewall tanpa mempertahankan akses SSH.

## 2. Upload melalui WinSCP

Unduh ZIP dan file SHA256 dari chat. Di WinSCP gunakan SFTP, host161.248.116.14, user SSH Anda, port22. Upload kedua file ke `/home/ubuntu/`. Tidak perlu mengirim password atau private key di chat.

```bash
cd /home/ubuntu
sha256sum -c febro-one-source-v1.0.zip.sha256
```

Hasil harus OK. Jika gagal, unduh/upload ulang; jangan ekstrak file rusak.

## 3. Dependensi sistem dan ekstraksi

Paket berikut tidak mengganti Node aplikasi lain. Jika server memakai PostgreSQL/Nginx kustom, sesuaikan dengan administrator terlebih dahulu.

```bash
sudo apt update
sudo apt install -y \
  ca-certificates curl xz-utils unzip ripgrep openssl \
  postgresql postgresql-client nginx \
  certbot python3-certbot-nginx age dnsutils
```

Folder tujuan harus belum berisi aplikasi lama. Jika sudah ada, gunakan bagian Update; jangan ekstrak menimpa konfigurasi/live data.

```bash
test ! -e /opt/febro-one
sudo install -d -m 755 -o "$USER" -g "$USER" /opt/febro-one
unzip febro-one-source-v1.0.zip -d /opt/febro-one
cd /opt/febro-one
chmod +x scripts/*.sh
```

ZIP berisi file pada root (bukan nested folder). `test` harus berhasil sebelum perintah berikutnya; jalankan per blok dan periksa setiap error.

## 4. User layanan dan Node terisolasi

```bash
getent passwd febro-one || sudo useradd \
  --system --home-dir /var/lib/febro-one \
  --shell /usr/sbin/nologin febro-one
sudo install -d -m 700 -o febro-one -g febro-one \
  /var/lib/febro-one /var/lib/febro-one/uploads
bash scripts/install-node.sh
export PATH="/opt/febro-one/runtime/node/bin:$PATH"
node --version
npm --version
```

Installer mengunduh Node24.19.0 dari nodejs.org dan memeriksa checksum resmi; runtime hanya di `/opt/febro-one/runtime/node`, tidak mengganti `/usr/bin/node`. Jika versi itu tidak tersedia, tentukan versi24 LTS yang telah Anda verifikasi lewat `FEBRO_NODE_VERSION=v24.x.y bash scripts/install-node.sh` (ganti angka, jangan gunakan literal x/y). Installer menolak menimpa runtime yang ada.

## 5. PostgreSQL khusus Febro One

```bash
sudo systemctl is-active postgresql
sudo bash scripts/preflight.sh
sudo bash scripts/init-db.sh
```

Skrip membuat **hanya** role/database `febro_one`, password acak dan `.env`. Jika role/database/.env sudah ada, skrip berhenti tanpa menimpanya. Jangan menghapus database yang sudah ada untuk melewati pemeriksaan. Untuk DB yang sengaja disiapkan manual, isi DATABASE_URL sendiri dan pastikan role memiliki schema public pada database khusus tersebut.

## 6. Konfigurasi environment

```bash
sudo nano /opt/febro-one/.env
sudo chown root:febro-one /opt/febro-one/.env
sudo chmod 640 /opt/febro-one/.env
```

Pertahankan password yang dibuat skrip. Nilai wajib:

| Variabel | Nilai |
|---|---|
| NODE_ENV | production |
| APP_ORIGIN | https://one.febro.id (tanpa slash akhir) |
| PORT | 3471 (localhost saja) |
| TZ | Asia/Jakarta |
| DATABASE_URL | postgresql://febro_one:PASSWORD@127.0.0.1:5432/febro_one |
| UPLOAD_DIR | /var/lib/febro-one/uploads |

Opsional: AI_BASE_URL provider kompatibel OpenAI, AI_MODEL, AI_API_KEY. Biarkan MODEL/KEY kosong jika belum memakai AI; UI akan menunjukkan setup. BACKUP_AGE_RECIPIENT berisi public recipient age, bukan private key. Jangan menaruh `VITE_TRIAL=true` pada production. `.env` juga dibaca skrip shell backup: beri tanda kutip jika nilai mengandung spasi/metakarakter, dan jangan salin isi dari sumber tak dipercaya.

## 7. Install, tes, build, migrasi

```bash
cd /opt/febro-one
bash scripts/build.sh
sudo -u febro-one env \
  PATH="/opt/febro-one/runtime/node/bin:$PATH" \
  bash /opt/febro-one/scripts/migrate.sh
```

Build harus berhasil. Periksa jumlah tes dan pastikan tidak ada fail. Migrasi dapat dijalankan ulang; migrasi yang sudah tercatat tidak dieksekusi ulang. Jika gagal, jangan mulai layanan sampai penyebab diperbaiki. Error koneksi DB: periksa DATABASE_URL/port/role tanpa menempelkan kredensial ke chat/log publik.

## 8. Buat admin pertama

Tidak ada username/password default. Gunakan email sendiri dan password unik minimal12 karakter. Password dibaca secara tersembunyi oleh shell, bukan ditulis dalam history.

```bash
read -r -p 'Email admin: ' ADMIN_EMAIL
read -r -p 'Nama tampilan: ' ADMIN_NAME
read -r -s -p 'Password minimal 12 karakter: ' ADMIN_PASSWORD
printf '\n'
export ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD
sudo --preserve-env=ADMIN_EMAIL,ADMIN_NAME,ADMIN_PASSWORD \
  -u febro-one env PATH="/opt/febro-one/runtime/node/bin:$PATH" \
  npm run admin
unset ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD
```

Simpan recovery code yang dicetak ke password manager/offline. Kode hanya sekali pakai. Skrip menolak membuat ulang admin jika user sudah ada. Jangan masukkan kode/password dalam tiket dukungan. Setelah build/migrasi, lindungi source dari user layanan:

```bash
sudo chown -R root:root /opt/febro-one
sudo chown root:febro-one /opt/febro-one/.env
sudo chmod 640 /opt/febro-one/.env
sudo chmod 755 /opt /opt/febro-one /opt/febro-one/dist
```

File statis dari build harus dapat dibaca Nginx; jangan chmod777. Source normal644/direktori755. Node runtime harus tetap executable.

## 9. systemd

Jangan menimpa layanan dengan nama sama yang bukan milik proyek ini.

```bash
test ! -e /etc/systemd/system/febro-one.service
sudo install -m 644 deploy/febro-one.service \
  /etc/systemd/system/febro-one.service
sudo systemctl daemon-reload
sudo systemctl enable --now febro-one
sudo systemctl status febro-one --no-pager
curl --fail http://127.0.0.1:3471/api/health
```

API bind127.0.0.1; jangan membuka3471 di firewall. Health harus berhasil sebelum Nginx.

## 10. Nginx khusus satu domain

Pastikan tidak ada `server_name one.febro.id` pada konfigurasi lain:

```bash
sudo nginx -T 2>&1 | rg 'server_name.*one\.febro\.id'
```

Tidak ada hasil adalah kondisi yang diharapkan untuk instalasi baru. Jika ditemukan, inspeksi dan sesuaikan host itu secara sengaja, jangan membuat duplikasi/menimpa aplikasi lain.

```bash
test ! -e /etc/nginx/sites-available/one.febro.id
sudo install -m 644 deploy/one.febro.id.conf \
  /etc/nginx/sites-available/one.febro.id
test ! -e /etc/nginx/sites-enabled/one.febro.id
sudo ln -s /etc/nginx/sites-available/one.febro.id \
  /etc/nginx/sites-enabled/one.febro.id
sudo nginx -t
sudo systemctl reload nginx
```

Reload hanya setelah `nginx -t` sukses. HTTP tahap ini untuk penerbitan sertifikat; login production memerlukan HTTPS.

## 11. HTTPS

Pastikan DNS benar, port80/443 dapat diakses dan tidak ada konflik host. Jangan membuka port lain.

```bash
dig +short one.febro.id A
sudo certbot --nginx -d one.febro.id --redirect
sudo nginx -t
sudo systemctl reload nginx
sudo certbot renew --dry-run
curl --fail https://one.febro.id/api/health
```

Certbot meminta email dan persetujuan dari Anda. Periksa perubahan hanya pada host ini. Buka https://one.febro.id di browser Anda, login menggunakan admin. Coba task, note, event, akun saldo0, transaksi uji/reversal, sertifikat contoh dan logout. Jangan pakai dokumen rahasia untuk uji pertama.

## 12. Acceptance setelah instalasi

- Login/session/recovery berjalan melalui HTTPS; CSRF invalid ditolak.
- API tanpa login tidak mengeluarkan record/file.
- Data tetap ada setelah restart hanya layanan febro-one.
- Transfer antar akun tidak menambah pendapatan; reversal mengembalikan saldo.
- File tidak bisa diakses lewat URL statis.
- Uji iPhone nyata, mode light/dark, keyboard/form, zona waktu.
- Rehearsal backup/restore pada lingkungan pengujian berhasil.
- Ukur Lighthouse mobile dari build production. Catat versi Chrome, jaringan/CPU throttling dan median3 run. LCP<=2.5s/CLS<=0.1 adalah target, belum bukti lulus. INP membutuhkan pengukuran interaksi/field, bukan sekadar skor Lighthouse.

## 13. Status dan troubleshooting

```bash
sudo systemctl status febro-one --no-pager
sudo journalctl -u febro-one -n 100 --no-pager
sudo nginx -t
sudo tail -n 60 /var/log/nginx/error.log
curl -i http://127.0.0.1:3471/api/health
sudo ss -ltnp | rg ':3471'
```

502: API/build/runtime/env belum benar. Login403: APP_ORIGIN harus cocok persis dengan domain HTTPS, hapus cookie lama/login ulang. EACCES: periksa pemilik upload dan group .env. Port in use: jangan membunuh layanan lain; pilih port baru lalu ubah .env, Nginx dan preflight secara konsisten. PWA lama: refresh/update service worker setelah deploy. Build RAM habis: build di mesin lain Node24 lalu upload dist/build sesuai source/lock; jangan mengubah swap VPS tanpa menilai aplikasi lain. AI setup: isi model/key server-side lalu restart febro-one saja.

## 14. Backup terenkripsi

Jalankan `age-keygen -o febro-one-backup.key` di komputer aman; simpan private identity di luar VPS. Ambil public recipient age1... dan isi BACKUP_AGE_RECIPIENT di .env. Pastikan identitas disimpan sebelum membuat backup, karena tanpa itu backup tidak dapat dibaca.

```bash
sudo bash /opt/febro-one/scripts/backup.sh
sudo ls -lh /var/backups/febro-one
```

Skrip menghentikan sementara hanya febro-one agar DB/file konsisten, lalu menyalakannya kembali jika semula aktif. Backup menyertakan database, upload, environment dan lockfile dalam arsip terenkripsi. Salin `.tar.age` dan `.sha256` ke komputer/offsite melalui WinSCP; jangan menyimpan satu-satunya backup pada VPS yang sama. Simpan ZIP source sesuai versi. Jadwalkan lewat cron/systemd timer milik proyek ini setelah uji manual sukses; jadwal otomatis belum dipasang oleh panduan.

## 15. Restore

**Restore mengganti seluruh isi database febro_one dan dokumennya.** Uji pada server pengujian lebih dulu. Siapkan aplikasi/source/schema versi yang cocok, database role dan .env target; buat backup terbaru sebelum restore. Upload backup dan age identity sementara ke folder root-only, chmod600. Identitas tidak masuk /opt atau web root.

```bash
sudo bash /opt/febro-one/scripts/restore.sh \
  /root/recovery/febro-one-TIMESTAMP.tar.age \
  /root/recovery/febro-one-backup.key \
  RESTORE
```

Ganti TIMESTAMP dengan nama asli. Ketik febro_one saat diminta. Skrip mempertahankan .env target; backup env hanya referensi. Folder upload lama dipertahankan dengan suffix timestamp. Jika restore gagal, layanan dibiarkan berhenti; jangan jalankan dengan database setengah pulih. Periksa log, restore ulang dari backup yang benar, kemudian health/login/files/balance. Hapus salinan sementara private identity dari VPS setelah verifikasi sesuai kebijakan Anda. Jangan menghapus backup lama sebelum hasil diverifikasi.

## 16. Update dan rollback

Unduh ZIP baru, cek SHA, baca matriks/perubahan migrasi. Buat backup dan catat versi. Ekstrak ke direktori staging terpisah milik userSSH; build/test di staging dengan Node runtime yang ada. Jangan menimpa .env, runtime, upload, atau database dengan isi ZIP. Hentikan hanya febro-one, salin source/build/dist yang telah diuji ke /opt/febro-one, pertahankan permission, jalankan migrasi sebagai user layanan, lalu start dan health check. Simpan source/build sebelumnya untuk rollback. Jika migrasi mengubah schema, rollback memerlukan restore database/files yang cocok—mengembalikan JS saja tidak cukup. Tidak ada mekanisme zero-downtime atau update otomatis dalam paket ini.
