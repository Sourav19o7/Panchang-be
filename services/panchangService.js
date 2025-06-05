const axios = require('axios');
const cheerio = require('cheerio');

class PanchangService {
  constructor() {
    this.baseUrl = 'https://www.drikpanchang.com';
    this.apiKey = process.env.PANCHANG_API_KEY;
    this.apiUrl = process.env.PANCHANG_API_URL;
  }

  // Scrape Panchang data from Drik Panchang
  async scrapePanchangData(date, location = 'delhi') {
    try {
      const formattedDate = this.formatDateForUrl(date);
      const url = `${this.baseUrl}/panchang/${location}/${formattedDate}`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      
      return this.extractPanchangInfo($, date);
    } catch (error) {
      console.error('Error scraping Panchang data:', error);
      throw new Error(`Failed to scrape Panchang data: ${error.message}`);
    }
  }

  // Extract structured information from scraped page
  extractPanchangInfo($, date) {
    const panchangData = {
      date: date,
      tithi: this.extractTithi($),
      nakshatra: this.extractNakshatra($),
      yog: this.extractYog($),
      karan: this.extractKaran($),
      sunrise: this.extractSunrise($),
      sunset: this.extractSunset($),
      moonrise: this.extractMoonrise($),
      moonset: this.extractMoonset($),
      grahaTransits: this.extractGrahaTransits($),
      auspiciousTimes: this.extractAuspiciousTimes($),
      inauspiciousTimes: this.extractInauspiciousTimes($),
      festivals: this.extractFestivals($),
      vrat: this.extractVrat($)
    };

    return panchangData;
  }

  extractTithi($) {
    const tithiElement = $('.tithi-text, .panchang-tithi, [data-tithi]').first();
    return tithiElement.text().trim() || 'Not Available';
  }

  extractNakshatra($) {
    const nakshatraElement = $('.nakshatra-text, .panchang-nakshatra, [data-nakshatra]').first();
    return nakshatraElement.text().trim() || 'Not Available';
  }

  extractYog($) {
    const yogElement = $('.yog-text, .panchang-yog, [data-yog]').first();
    return yogElement.text().trim() || 'Not Available';
  }

  extractKaran($) {
    const karanElement = $('.karan-text, .panchang-karan, [data-karan]').first();
    return karanElement.text().trim() || 'Not Available';
  }

  extractSunrise($) {
    const sunriseElement = $('.sunrise-time, .sun-rise, [data-sunrise]').first();
    return sunriseElement.text().trim() || 'Not Available';
  }

  extractSunset($) {
    const sunsetElement = $('.sunset-time, .sun-set, [data-sunset]').first();
    return sunsetElement.text().trim() || 'Not Available';
  }

  extractMoonrise($) {
    const moonriseElement = $('.moonrise-time, .moon-rise, [data-moonrise]').first();
    return moonriseElement.text().trim() || 'Not Available';
  }

  extractMoonset($) {
    const moonsetElement = $('.moonset-time, .moon-set, [data-moonset]').first();
    return moonsetElement.text().trim() || 'Not Available';
  }

  extractGrahaTransits($) {
    const transits = [];
    $('.graha-transit, .planet-transit').each((index, element) => {
      const $element = $(element);
      transits.push({
        planet: $element.find('.planet-name').text().trim(),
        sign: $element.find('.planet-sign').text().trim(),
        degree: $element.find('.planet-degree').text().trim()
      });
    });
    return transits;
  }

  extractAuspiciousTimes($) {
    const times = [];
    $('.auspicious-time, .shubh-muhurat').each((index, element) => {
      const $element = $(element);
      times.push({
        name: $element.find('.muhurat-name').text().trim(),
        time: $element.find('.muhurat-time').text().trim(),
        duration: $element.find('.muhurat-duration').text().trim()
      });
    });
    return times;
  }

  extractInauspiciousTimes($) {
    const times = [];
    $('.inauspicious-time, .ashubh-muhurat').each((index, element) => {
      const $element = $(element);
      times.push({
        name: $element.find('.muhurat-name').text().trim(),
        time: $element.find('.muhurat-time').text().trim(),
        duration: $element.find('.muhurat-duration').text().trim()
      });
    });
    return times;
  }

  extractFestivals($) {
    const festivals = [];
    $('.festival, .tyohar').each((index, element) => {
      const $element = $(element);
      festivals.push($element.text().trim());
    });
    return festivals;
  }

  extractVrat($) {
    const vrats = [];
    $('.vrat, .fasting').each((index, element) => {
      const $element = $(element);
      vrats.push($element.text().trim());
    });
    return vrats;
  }

  // Get monthly Panchang data
  async getMonthlyPanchang(year, month, location = 'delhi') {
    try {
      const daysInMonth = new Date(year, month, 0).getDate();
      const monthlyData = [];

      // Process in batches to avoid overwhelming the server
      const batchSize = 7;
      for (let i = 1; i <= daysInMonth; i += batchSize) {
        const batch = [];
        const endDay = Math.min(i + batchSize - 1, daysInMonth);
        
        for (let day = i; day <= endDay; day++) {
          const date = new Date(year, month - 1, day);
          batch.push(this.scrapePanchangData(date, location));
        }

        const batchResults = await Promise.allSettled(batch);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            monthlyData.push(result.value);
          } else {
            console.error(`Failed to get data for day ${i + index}:`, result.reason);
            // Add placeholder data
            monthlyData.push({
              date: new Date(year, month - 1, i + index),
              error: result.reason.message,
              tithi: 'Error',
              nakshatra: 'Error'
            });
          }
        });

        // Add delay between batches to be respectful
        if (i + batchSize <= daysInMonth) {
          await this.delay(2000);
        }
      }

      return {
        year,
        month,
        location,
        data: monthlyData,
        summary: this.generateMonthlySummary(monthlyData)
      };
    } catch (error) {
      console.error('Error getting monthly Panchang:', error);
      throw error;
    }
  }

  generateMonthlySummary(monthlyData) {
    const summary = {
      totalDays: monthlyData.length,
      festivals: [],
      vrats: [],
      auspiciousDates: [],
      majorTithis: {}
    };

    monthlyData.forEach(dayData => {
      if (dayData.festivals && dayData.festivals.length > 0) {
        summary.festivals.push(...dayData.festivals);
      }
      
      if (dayData.vrat && dayData.vrat.length > 0) {
        summary.vrats.push(...dayData.vrat);
      }

      if (dayData.auspiciousTimes && dayData.auspiciousTimes.length > 2) {
        summary.auspiciousDates.push(dayData.date);
      }

      // Count tithi occurrences
      if (dayData.tithi && dayData.tithi !== 'Error' && dayData.tithi !== 'Not Available') {
        summary.majorTithis[dayData.tithi] = (summary.majorTithis[dayData.tithi] || 0) + 1;
      }
    });

    return summary;
  }

  // Utility method for API alternative (if available)
  async getPanchangFromAPI(date, location = 'delhi') {
    if (!this.apiKey || !this.apiUrl) {
      throw new Error('Panchang API credentials not configured');
    }

    try {
      const response = await axios.get(`${this.apiUrl}/panchang`, {
        params: {
          date: this.formatDateForAPI(date),
          location: location,
          api_key: this.apiKey
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error calling Panchang API:', error);
      throw error;
    }
  }

  // Helper methods
  formatDateForUrl(date) {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  formatDateForAPI(date) {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get specific tithi dates for a month
  async getTithiDates(year, month, targetTithi, location = 'delhi') {
    const monthlyData = await this.getMonthlyPanchang(year, month, location);
    return monthlyData.data.filter(day => 
      day.tithi && day.tithi.toLowerCase().includes(targetTithi.toLowerCase())
    );
  }

  // Get festival dates for a month
  async getFestivalDates(year, month, location = 'delhi') {
    const monthlyData = await this.getMonthlyPanchang(year, month, location);
    return monthlyData.data.filter(day => 
      day.festivals && day.festivals.length > 0
    );
  }
}

module.exports = new PanchangService();