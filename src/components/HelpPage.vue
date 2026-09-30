<script setup>
const emit = defineEmits(["close-help"]);

const fourPlayerNegativeRules = [
  "Harten: -30 per hartenkaart",
  "Slagen: -50 per slag",
  "Laatste 2 slagen: -140 per slag",
  "Mannen: -60 per boer/heer",
  "Vrouwen: -100 per vrouw",
  "Hartenheer: -400 als je hem krijgt",
];

const threePlayerNegativeRules = [
  "Harten: -50 per hartenkaart",
  "Slagen: -40 per slag",
  "Laatste 2 slagen: -145 per slag",
  "Mannen: -80 per boer/heer",
  "Vrouwen: -100 per vrouw",
  "Hartenheer: -400 als je hem krijgt",
];
</script>

<template>
  <section
    class="mx-auto mt-8 w-full max-w-2xl rounded-xl border border-sky-600 bg-sky-50 p-3 shadow-sm">
    <div
      class="flex flex-wrap items-start justify-between gap-2 pb-1 text-sky-900">
      <div>
        <div class="flex items-center gap-4 text-sky-900">
          <h1 class="text-2xl font-bold text-sky-900">
            Spelregels & Instructies
          </h1>
          <button
            type="button"
            class="ml-auto rounded border border-sky-300 bg-white px-3 py-1 text-sm font-semibold text-sky-800 hover:bg-sky-50"
            @click="emit('close-help')">
            Terug naar lobby
          </button>
        </div>
        <p class="text-sm text-sky-800">
          Deze app is gemaakt om het bijhouden van scores bij het kaartspel
          <span class="font-semibold">Kingen</span> makkelijker te maken.
        </p>
      </div>
    </div>

    <div class="mt-1">
      <article class="rounded-lg border border-sky-200 bg-white p-3">
        <h2 class="text-lg font-semibold text-sky-900">Het spel</h2>
        <ul class="mt-2 list-disc space-y-1 pl-3 text-sm">
          <li>
            Het spel wordt gespeeld met 3 of 4 spelers en een standaard
            kaartspel met 52 (of 51 bij 3 spelers) kaarten.
          </li>
          <li>
            4 spelers: 52 kaarten, 12 negatieve rondes (6 spellen x 2) + 8
            troefrondes.
          </li>
          <li>
            3 spelers: 51 kaarten (&clubs; 2 eruit), 12 negatieve rondes (6
            spellen x 2) + 9 troefrondes.
          </li>
          <li>
            Keuzes per speler: 4 spelers kiest 3x negatief en 2x positief; 3
            spelers kiest 4x negatief en 3x positief.
          </li>
          <li>Om beurten kiezen spelers een beschikbaar spel uit de lijst.</li>
          <li>Er zijn spellen met negatieve en positieve punten.</li>
          <li>
            De speler met de hoogste kaart deelt. De volgende speler kiest het
            speltype voor de ronde.
          </li>
          <li>De volgende speler komt uit en legt zijn kaart op tafel.</li>
          <li>
            Elke speler voegt zijn kaart toe, volgens de volgende regels:
            <ul>
              <li>- Je moet kleur bekennen als je kunt.</li>
              <li>
                - Als er een Hartenspel wordt gespeeld (geen Harten of geen
                Hartenheer), mag je niet met harten uitkomen, tot dat er een
                harten kaart is bijgelegd in een eerdere slag.
              </li>
              <li>
                - Als er troef wordt gespeeld, mag je alleen troeven als je niet
                kunt bekennen. Troeven is niet verplicht.
              </li>
            </ul>
          </li>
          <li>Kaarten met strafpunten worden open gelegd.</li>
          <li>De speler die de slag wint, begint de volgende slag.</li>
          <li>
            Aan het eind van de ronde worden de punten geteld en ingevoerd in de
            app.
          </li>
          <li>
            De punten zijn zo verdeeld dat aan het eind van het spel de totale
            score precies 0 is.
          </li>
          <li>
            Spelers met een positieve score ontvangen van de spelers met een
            negatieve score een vooraf afgesproken beloning (de eer, een
            drankje, geld, etc.).
          </li>
        </ul>
      </article>
      <article
        class="rounded-lg border border-sky-200 bg-white p-3 md:col-span-2">
        <h2 class="text-lg font-semibold text-sky-900">
          Puntverdeling 4 spelers
        </h2>
        <p class="text-sm text-sky-900">
          In de 12 negatieve rondes zijn er verschillende manieren om
          strafpunten te krijgen:
        </p>
        <ul
          class="grid list-disc gap-1 pl-3 text-sm text-sky-900 md:grid-cols-2">
          <li v-for="rule in fourPlayerNegativeRules" :key="rule">
            {{ rule }}
          </li>
        </ul>
        <p class="mt-2 text-sm text-sky-900">
          In de 8 troefrondes telt elke gewonnen slag voor 50 punten.
        </p>

        <h2 class="mt-3 text-lg font-semibold text-sky-900">
          Puntverdeling 3 spelers
        </h2>
        <ul
          class="grid list-disc gap-1 pl-3 text-sm text-sky-900 md:grid-cols-2">
          <li v-for="rule in threePlayerNegativeRules" :key="rule">
            {{ rule }}
          </li>
        </ul>
        <p class="mt-2 text-sm text-sky-900">
          In de 9 troefrondes telt elke gewonnen slag voor 40 punten (maximaal
          17 slagen per ronde).
        </p>
      </article>
      <article class="rounded-lg border border-sky-200 bg-white p-3">
        <h2 class="text-lg font-semibold text-sky-900">
          Instructies voor de app
        </h2>
        <ol class="list-decimal space-y-1 pl-5 text-sm text-sky-900">
          <li>Kies 3 of 4 spelers</li>
          <li>
            Selecteer eventueel spelersnamen in, in de lobby (als de beheerscode
            is ingevoerd).
          </li>
          <li>Klik op "Start als Gastheer".</li>
          <li>De gastheer vult als enige de scores in.</li>
          <li>In het score scherm is een knop voor een QR-code</li>
          <li>
            De andere spelers (of toeschouwers) kunnen met behulp van de link in
            de QR-code het scorescherm op hun eigen telefoon openen.
          </li>
          <ul class="mt-2 list-disc space-y-1 pl-3 text-sm"></ul>
          <p class="mt-2 text-xs">
            Bij twee positieve spelers krijgt elk een beloning van één van de
            'negatieve' spelers. Als er één speler is met negatieve eindstand,
            moet deze drie beloningen uitkeren; als er één speler is met een
            postitieve eindstand ontvangt deze drie beloningen. <br />
            Theoretisch kan iedereen op 0 uitkomen, maar die kans is minimaal.
          </p>
        </ol>
        <h2 class="mt-2 text-lg font-semibold text-sky-900">Scores invullen</h2>
        <ul class="list-disc space-y-1 pl-5 text-sm text-sky-900">
          <li>
            Vink onder de naam van de speler de betreffende spelkeuze aan, de
            mogelijke keuzes zijn lichtgeel gemarkeerd.
          </li>
          <li>
            Na afloop van de ronde vult de gastheer voor elke speler de scores
            in, mbv de keuzelijst (als alles is ingevuld, wordt de regel
            lichtgroen)
          </li>
          <li>
            Nadat alle scores zijn ingevoerd, worden de mogelijke keuzes van de
            volgende speler weergegeven in lichtgeel.
          </li>
          <li>
            De app houdt bij wat er al gekozen is en berekent punten
            automatisch.
          </li>
        </ul>
      </article>

    </div>
  </section>
</template>
