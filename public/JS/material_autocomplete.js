// public/js/material_autocomplete.js

document.addEventListener('DOMContentLoaded', () => {
  const materialInput = document.getElementById('material_input');
  const datalist = document.getElementById('material_datalist');

  materialInput.addEventListener('input', () => {
    const suchbegriff = materialInput.value.trim();
    if (suchbegriff.length < 2) return;

    fetch(`/material/autocomplete?s=${encodeURIComponent(suchbegriff)}`)
      .then(res => res.json())
      .then(vorschlaege => {
        datalist.innerHTML = '';
        vorschlaege.forEach(item => {
          const option = document.createElement('option');
          option.value = `${item.e_nummer} – ${item.bezeichnung}`;
          option.dataset.eNummer = item.e_nummer;
          option.dataset.preis = item.preis;
          datalist.appendChild(option);
        });
      });
  });

  materialInput.addEventListener('change', () => {
    const auswahl = Array.from(datalist.options).find(
      o => o.value === materialInput.value
    );
    if (auswahl) {
      document.getElementById('e_nummer').value = auswahl.dataset.eNummer;
      document.getElementById('preis').value = parseFloat(auswahl.dataset.preis * 1.6).toFixed(2);
    }
  });
});
