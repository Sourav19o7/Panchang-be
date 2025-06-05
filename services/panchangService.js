const axios = require('axios');

class PanchangService {
  constructor() {
    this.apiUrl = 'https://json.freeastrologyapi.com/complete-panchang';
    this.apiKey = process.env.PANCHANG_API_KEY || 'YOUR_API_KEY_HERE'; // Set this in your .env file
    
    // Default location coordinates (Delhi)
    this.defaultLocation = {
      latitude: 28.6139,
      longitude: 77.2090,
      timezone: 5.5,
      name: 'delhi'
    };

    // Location coordinates mapping
    this.locationCoordinates = {
      'delhi': { latitude: 28.6139, longitude: 77.2090, timezone: 5.5 },
      'mumbai': { latitude: 19.0760, longitude: 72.8777, timezone: 5.5 },
      'bangalore': { latitude: 12.9716, longitude: 77.5946, timezone: 5.5 },
      'kolkata': { latitude: 22.5726, longitude: 88.3639, timezone: 5.5 },
      'chennai': { latitude: 13.0827, longitude: 80.2707, timezone: 5.5 },
      'hyderabad': { latitude: 17.3850, longitude: 78.4867, timezone: 5.5 },
      'pune': { latitude: 18.5204, longitude: 73.8567, timezone: 5.5 },
      'ahmedabad': { latitude: 23.0225, longitude: 72.5714, timezone: 5.5 },
      'surat': { latitude: 21.1702, longitude: 72.8311, timezone: 5.5 },
      'jaipur': { latitude: 26.9124, longitude: 75.7873, timezone: 5.5 },
      'lucknow': { latitude: 26.8467, longitude: 80.9462, timezone: 5.5 },
      'kanpur': { latitude: 26.4499, longitude: 80.3319, timezone: 5.5 },
      'nagpur': { latitude: 21.1458, longitude: 79.0882, timezone: 5.5 },
      'indore': { latitude: 22.7196, longitude: 75.8577, timezone: 5.5 },
      'thane': { latitude: 19.2183, longitude: 72.9781, timezone: 5.5 },
      'bhopal': { latitude: 23.2599, longitude: 77.4126, timezone: 5.5 },
      'visakhapatnam': { latitude: 17.6868, longitude: 83.2185, timezone: 5.5 },
      'vadodara': { latitude: 22.3072, longitude: 73.1812, timezone: 5.5 },
      'chandigarh': { latitude: 30.7333, longitude: 76.7794, timezone: 5.5 },
      'coimbatore': { latitude: 11.0168, longitude: 76.9558, timezone: 5.5 }
    };
  }

  // Get coordinates for a location
  getLocationCoordinates(location) {
    const locationKey = location.toLowerCase();
    return this.locationCoordinates[locationKey] || this.defaultLocation;
  }

  // Get Panchang data for a specific date
  async getPanchangForDate(date, location = 'delhi') {
    try {
      const dateObj = new Date(date);
      const coordinates = this.getLocationCoordinates(location);
      
      const requestBody = {
        year: dateObj.getFullYear(),
        month: dateObj.getMonth() + 1, // API expects 1-12
        date: dateObj.getDate(),
        hours: 6, // Default to 6 AM
        minutes: 0,
        seconds: 0,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        timezone: coordinates.timezone,
        config: {
          observation_point: "topocentric",
          ayanamsha: "lahiri"
        }
      };

      console.log(`Fetching Panchang for ${date} at ${location}:`, requestBody);

      const response = await axios.post(this.apiUrl, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        },
        timeout: 15000
      });

      if (response.status !== 200) {
        throw new Error(`API returned status ${response.status}: ${response.statusText}`);
      }

      return this.formatPanchangResponse(response.data, date, location);

    } catch (error) {
      console.error('Error fetching Panchang data:', error.message);
      
      if (error.response) {
        // API returned an error response
        throw new Error(`Panchang API error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`);
      } else if (error.request) {
        // Request was made but no response received
        throw new Error('Panchang API is not responding. Please try again later.');
      } else {
        // Something else happened
        throw new Error(`Panchang request failed: ${error.message}`);
      }
    }
  }

  // Format the API response to match our expected structure
  formatPanchangResponse(apiData, date, location) {
    try {
      // Extract festivals and special occasions (you can enhance this based on date)
      const festivals = this.getFestivalsForDate(new Date(date));
      const vrats = this.getVratsForDate(new Date(date));

      return {
        date: date,
        location: location,
        source: 'Free Astrology API',
        
        // Basic Panchang elements
        tithi: apiData.tithi?.name || 'Not Available',
        tithiNumber: apiData.tithi?.number || null,
        paksha: apiData.tithi?.paksha || 'Not Available',
        tithiCompletesAt: apiData.tithi?.completes_at || null,
        
        nakshatra: apiData.nakshatra?.name || 'Not Available',
        nakshatraNumber: apiData.nakshatra?.number || null,
        nakshatraStartsAt: apiData.nakshatra?.starts_at || null,
        nakshatraEndsAt: apiData.nakshatra?.ends_at || null,
        
        // Yoga information
        yoga: this.formatYogaData(apiData.yoga),
        
        // Karana information  
        karana: this.formatKaranaData(apiData.karana),
        
        // Sun and Moon timings
        sunrise: apiData.sun_rise || 'Not Available',
        sunset: apiData.sun_set || 'Not Available',
        
        // Day information
        weekday: apiData.weekday?.weekday_name || 'Not Available',
        vedicWeekday: apiData.weekday?.vedic_weekday_name || 'Not Available',
        
        // Lunar month information
        lunarMonth: apiData.lunar_month?.lunar_month_name || 'Not Available',
        lunarMonthNumber: apiData.lunar_month?.lunar_month_number || null,
        
        // Season and year information
        ritu: apiData.ritu?.name || 'Not Available',
        aayanam: apiData.aayanam || 'Not Available',
        
        // Year information
        sakaYear: apiData.year?.saka_salivahana_number || null,
        sakaYearName: apiData.year?.saka_salivahana_year_name || 'Not Available',
        vikramYear: apiData.year?.vikram_chaitradi_number || null,
        vikramYearName: apiData.year?.vikram_chaitradi_year_name || 'Not Available',
        
        // Additional computed information
        festivals: festivals,
        vrat: vrats,
        auspiciousTimes: this.getAuspiciousTimes(apiData),
        inauspiciousTimes: this.getInauspiciousTimes(apiData),
        
        // Graha transit information (simplified)
        grahaTransits: this.getGrahaTransits(apiData),
        
        // API response timestamp
        timestamp: apiData.year?.timestamp || new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error formatting Panchang response: ${error.message}`);
    }
  }

  // Format yoga data from API response
  formatYogaData(yogaData) {
    if (!yogaData) return 'Not Available';
    
    const yogas = [];
    Object.keys(yogaData).forEach(key => {
      const yoga = yogaData[key];
      yogas.push({
        name: yoga.name,
        number: yoga.number,
        completion: yoga.completion,
        leftPercentage: yoga.yoga_left_percentage
      });
    });
    
    return yogas.length > 0 ? yogas : 'Not Available';
  }

  // Format karana data from API response
  formatKaranaData(karanaData) {
    if (!karanaData) return 'Not Available';
    
    const karanas = [];
    Object.keys(karanaData).forEach(key => {
      const karana = karanaData[key];
      karanas.push({
        name: karana.name,
        number: karana.number,
        completion: karana.completion,
        leftPercentage: karana.karana_left_percentage
      });
    });
    
    return karanas.length > 0 ? karanas : 'Not Available';
  }

  // Get auspicious times based on the Panchang data
  getAuspiciousTimes(apiData) {
    const auspiciousTimes = [];
    
    // Add brahma muhurat (1.5 hours before sunrise)
    if (apiData.sun_rise) {
      const sunrise = new Date(`2000-01-01 ${apiData.sun_rise}`);
      const brahmaMuhurat = new Date(sunrise.getTime() - 90 * 60000); // 1.5 hours before
      auspiciousTimes.push({
        name: 'Brahma Muhurat',
        time: `${brahmaMuhurat.getHours().toString().padStart(2, '0')}:${brahmaMuhurat.getMinutes().toString().padStart(2, '0')}`,
        duration: '1 hour 36 minutes',
        significance: 'Most auspicious time for spiritual practices'
      });
    }
    
    // Add other auspicious times based on tithi and nakshatra
    if (apiData.tithi?.name === 'Purnima') {
      auspiciousTimes.push({
        name: 'Purnima Celebration',
        time: 'Evening',
        duration: '3 hours',
        significance: 'Full moon - highly auspicious for all activities'
      });
    }
    
    if (apiData.nakshatra?.name === 'Rohini') {
      auspiciousTimes.push({
        name: 'Rohini Nakshatra',
        time: 'All day',
        duration: 'Full day',
        significance: 'Highly favorable for new beginnings'
      });
    }
    
    return auspiciousTimes;
  }

  // Get inauspicious times
  getInauspiciousTimes(apiData) {
    const inauspiciousTimes = [];
    
    // Add Rahu Kaal (calculated based on weekday)
    const rahuKaal = this.calculateRahuKaal(apiData.weekday?.weekday_number, apiData.sun_rise, apiData.sun_set);
    if (rahuKaal) {
      inauspiciousTimes.push(rahuKaal);
    }
    
    // Add Yamaganda Kaal
    const yamaganda = this.calculateYamagandaKaal(apiData.weekday?.weekday_number, apiData.sun_rise, apiData.sun_set);
    if (yamaganda) {
      inauspiciousTimes.push(yamaganda);
    }
    
    return inauspiciousTimes;
  }

  // Calculate Rahu Kaal based on weekday
  calculateRahuKaal(weekdayNumber, sunrise, sunset) {
    if (!weekdayNumber || !sunrise || !sunset) return null;
    
    const rahuKaalPeriods = {
      1: 7.5, // Monday - 7:30-9:00 AM
      2: 15,  // Tuesday - 3:00-4:30 PM  
      3: 12,  // Wednesday - 12:00-1:30 PM
      4: 13.5, // Thursday - 1:30-3:00 PM
      5: 10.5, // Friday - 10:30-12:00 PM
      6: 9,   // Saturday - 9:00-10:30 AM
      0: 16.5 // Sunday - 4:30-6:00 PM
    };
    
    const startHour = rahuKaalPeriods[weekdayNumber];
    if (startHour) {
      const hours = Math.floor(startHour);
      const minutes = (startHour % 1) * 60;
      return {
        name: 'Rahu Kaal',
        time: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} - ${(hours + 1).toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
        duration: '1 hour 30 minutes',
        significance: 'Inauspicious period - avoid starting new activities'
      };
    }
    
    return null;
  }

  // Calculate Yamaganda Kaal
  calculateYamagandaKaal(weekdayNumber, sunrise, sunset) {
    if (!weekdayNumber || !sunrise || !sunset) return null;
    
    const yamagandaPeriods = {
      1: 12,  // Monday - 12:00-1:30 PM
      2: 10.5, // Tuesday - 10:30-12:00 PM
      3: 15,  // Wednesday - 3:00-4:30 PM
      4: 7.5, // Thursday - 7:30-9:00 AM
      5: 13.5, // Friday - 1:30-3:00 PM
      6: 16.5, // Saturday - 4:30-6:00 PM
      0: 9    // Sunday - 9:00-10:30 AM
    };
    
    const startHour = yamagandaPeriods[weekdayNumber];
    if (startHour) {
      const hours = Math.floor(startHour);
      const minutes = (startHour % 1) * 60;
      return {
        name: 'Yamaganda Kaal',
        time: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} - ${(hours + 1).toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
        duration: '1 hour 30 minutes',
        significance: 'Inauspicious period - avoid important activities'
      };
    }
    
    return null;
  }

  // Get simplified graha transit information
  getGrahaTransits(apiData) {
    // This is simplified - you could enhance with actual planetary position APIs
    return [
      {
        planet: 'Sun',
        sign: this.getSunSign(apiData.lunar_month?.lunar_month_number),
        degree: 'Variable'
      },
      {
        planet: 'Moon',
        sign: this.getMoonSign(apiData.nakshatra?.number),
        degree: 'Variable'
      }
    ];
  }

  // Get sun sign based on lunar month (simplified)
  getSunSign(lunarMonthNumber) {
    const sunSigns = {
      1: 'Aries', 2: 'Taurus', 3: 'Gemini', 4: 'Cancer',
      5: 'Leo', 6: 'Virgo', 7: 'Libra', 8: 'Scorpio',
      9: 'Sagittarius', 10: 'Capricorn', 11: 'Aquarius', 12: 'Pisces'
    };
    return sunSigns[lunarMonthNumber] || 'Variable';
  }

  // Get moon sign based on nakshatra (simplified)
  getMoonSign(nakshatraNumber) {
    if (!nakshatraNumber) return 'Variable';
    
    const moonSigns = {
      1: 'Aries', 2: 'Aries', 3: 'Aries', 4: 'Taurus',
      5: 'Taurus', 6: 'Taurus', 7: 'Gemini', 8: 'Gemini',
      9: 'Cancer', 10: 'Cancer', 11: 'Leo', 12: 'Leo',
      13: 'Virgo', 14: 'Virgo', 15: 'Virgo', 16: 'Libra',
      17: 'Libra', 18: 'Libra', 19: 'Scorpio', 20: 'Scorpio',
      21: 'Scorpio', 22: 'Sagittarius', 23: 'Sagittarius',
      24: 'Aquarius', 25: 'Aquarius', 26: 'Aquarius', 27: 'Pisces'
    };
    
    return moonSigns[nakshatraNumber] || 'Variable';
  }

  // Get festivals for a specific date (you can enhance this with a comprehensive festival database)
  getFestivalsForDate(date) {
    const festivals = [];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // Add some major festivals (enhance this with a proper festival calendar)
    const majorFestivals = {
      '1-26': ['Republic Day'],
      '8-15': ['Independence Day'],
      '10-2': ['Gandhi Jayanti'],
      '3-21': ['Holi (approximate)'],
      '10-24': ['Dussehra (approximate)'],
      '11-12': ['Diwali (approximate)']
    };
    
    const dateKey = `${month}-${day}`;
    if (majorFestivals[dateKey]) {
      festivals.push(...majorFestivals[dateKey]);
    }
    
    return festivals;
  }

  // Get vrats (fasting days) for a specific date
  getVratsForDate(date) {
    const vrats = [];
    const dayOfWeek = date.getDay();
    
    // Add regular vrats
    if (dayOfWeek === 1) { // Monday
      vrats.push('Somvar Vrat');
    }
    if (dayOfWeek === 6) { // Saturday
      vrats.push('Shanivar Vrat');
    }
    
    return vrats;
  }

  // Get monthly Panchang data
  async getMonthlyPanchang(year, month, location = 'delhi') {
    try {
      const daysInMonth = new Date(year, month, 0).getDate();
      const monthlyData = [];
      const errors = [];

      console.log(`Generating Panchang for ${month}/${year} (${daysInMonth} days) using Free Astrology API`);

      // Process in batches to respect API rate limits
      const batchSize = 5; // Reduce batch size for API calls
      const delayBetweenCalls = 1000; // 1 second delay between API calls
      
      for (let i = 1; i <= daysInMonth; i += batchSize) {
        const batch = [];
        const endDay = Math.min(i + batchSize - 1, daysInMonth);
        
        console.log(`Processing days ${i} to ${endDay}`);
        
        for (let day = i; day <= endDay; day++) {
          const date = new Date(year, month - 1, day);
          const dateString = date.toISOString().split('T')[0];
          
          // Add delay between individual API calls
          if (day > i) {
            await this.delay(delayBetweenCalls);
          }
          
          batch.push(this.getPanchangForDate(dateString, location));
        }

        const batchResults = await Promise.allSettled(batch);
        
        batchResults.forEach((result, index) => {
          const day = i + index;
          if (result.status === 'fulfilled') {
            monthlyData.push(result.value);
          } else {
            console.error(`Failed to get data for day ${day}:`, result.reason.message);
            errors.push(`Day ${day}: ${result.reason.message}`);
            
            // Add error entry
            monthlyData.push({
              date: new Date(year, month - 1, day).toISOString().split('T')[0],
              error: result.reason.message,
              tithi: 'Error',
              nakshatra: 'Error'
            });
          }
        });

        // Add delay between batches
        if (i + batchSize <= daysInMonth) {
          await this.delay(2000); // 2 second delay between batches
        }
      }

      // Check if we have enough valid data
      const validData = monthlyData.filter(day => !day.error);
      if (validData.length === 0) {
        throw new Error('No valid Panchang data could be retrieved for any day of the month');
      }

      return {
        year,
        month,
        location,
        data: monthlyData,
        summary: this.generateMonthlySummary(monthlyData),
        errors: errors.length > 0 ? errors : undefined,
        dataSource: 'Free Astrology API',
        apiCalls: monthlyData.length
      };

    } catch (error) {
      console.error('Error getting monthly Panchang:', error);
      throw new Error(`Monthly Panchang generation failed: ${error.message}`);
    }
  }

  generateMonthlySummary(monthlyData) {
    const summary = {
      totalDays: monthlyData.length,
      festivals: [],
      vrats: [],
      auspiciousDates: [],
      majorTithis: {},
      errorCount: 0,
      dataQuality: 0
    };

    monthlyData.forEach(dayData => {
      if (dayData.error) {
        summary.errorCount++;
        return;
      }

      if (dayData.festivals && dayData.festivals.length > 0) {
        summary.festivals.push(...dayData.festivals);
      }
      
      if (dayData.vrat && dayData.vrat.length > 0) {
        summary.vrats.push(...dayData.vrat);
      }

      if (dayData.auspiciousTimes && dayData.auspiciousTimes.length > 0) {
        summary.auspiciousDates.push(dayData.date);
      }

      // Count tithi occurrences
      if (dayData.tithi && dayData.tithi !== 'Error' && dayData.tithi !== 'Not Available') {
        summary.majorTithis[dayData.tithi] = (summary.majorTithis[dayData.tithi] || 0) + 1;
      }
    });

    summary.dataQuality = Math.round(((monthlyData.length - summary.errorCount) / monthlyData.length) * 100);

    return summary;
  }

  // Utility methods
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get specific tithi dates for a month
  async getTithiDates(year, month, targetTithi, location = 'delhi') {
    try {
      const monthlyData = await this.getMonthlyPanchang(year, month, location);
      return monthlyData.data.filter(day => 
        day.tithi && day.tithi.toLowerCase().includes(targetTithi.toLowerCase()) && !day.error
      );
    } catch (error) {
      throw new Error(`Failed to get tithi dates: ${error.message}`);
    }
  }

  // Get festival dates for a month
  async getFestivalDates(year, month, location = 'delhi') {
    try {
      const monthlyData = await this.getMonthlyPanchang(year, month, location);
      return monthlyData.data.filter(day => 
        day.festivals && day.festivals.length > 0 && !day.error
      );
    } catch (error) {
      throw new Error(`Failed to get festival dates: ${error.message}`);
    }
  }

  // Check API availability
  async checkAPIStatus() {
    try {
      const testDate = new Date();
      await this.getPanchangForDate(testDate.toISOString().split('T')[0], 'delhi');
      return { status: 'available', message: 'API is working correctly' };
    } catch (error) {
      return { status: 'unavailable', message: error.message };
    }
  }
}

module.exports = new PanchangService();