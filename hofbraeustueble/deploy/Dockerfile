# Hofbräustüble – Vorschau-Server (Website + CMS + Tippspiel) als ein Container.
#
# PHP 8.3 + Apache. Alles, was sich zur Laufzeit ändert (Inhalte, Passwort,
# hochgeladene Bilder, Backups, Tippspiel-Datenbank), liegt NICHT im Image,
# sondern im Volume /srv/hbs-state. Ein neues Image (Update) behält also alle
# Daten – siehe docker-entrypoint.sh.
FROM php:8.3-apache

# GD für Bild-Uploads (Verkleinern, EXIF/GPS entfernen). pdo_sqlite und curl
# sind im offiziellen Image bereits enthalten.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libpng-dev libjpeg62-turbo-dev libwebp-dev \
 && docker-php-ext-configure gd --with-jpeg --with-webp \
 && docker-php-ext-install -j"$(nproc)" gd \
 && rm -rf /var/lib/apt/lists/*

RUN a2enmod headers rewrite \
 && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

COPY deploy/apache-site.conf /etc/apache2/conf-enabled/zz-hbs.conf
COPY deploy/php.ini "$PHP_INI_DIR/conf.d/zz-hbs.ini"
COPY deploy/docker-entrypoint.sh /usr/local/bin/hbs-entrypoint
COPY deploy/seed.php deploy/cron.php deploy/ligen.php /usr/local/lib/hbs/

# Die Website selbst (ohne Deploy-Dateien, Entwurfs-Screenshots und Doku)
COPY . /var/www/html/
RUN rm -rf /var/www/html/deploy /var/www/html/variante-*/screenshots /var/www/html/tippspiel/screenshots \
           /var/www/html/README.md /var/www/html/tippspiel/SPEC.md \
 && mkdir -p /usr/local/share/hbs \
 && mv /var/www/html/cms/content.json /usr/local/share/hbs/content.json \
 && mv /var/www/html/cms/config.php /usr/local/share/hbs/config.php \
 && rm -rf /var/www/html/cms/data /var/www/html/cms/uploads /var/www/html/cms/backups
COPY cms/uploads/.htaccess /usr/local/share/hbs/uploads.htaccess
COPY cms/backups/.htaccess /usr/local/share/hbs/deny.htaccess
RUN chmod +x /usr/local/bin/hbs-entrypoint

VOLUME /srv/hbs-state
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -fsS -o /dev/null http://127.0.0.1/ || exit 1
ENTRYPOINT ["hbs-entrypoint"]
CMD ["apache2-foreground"]
