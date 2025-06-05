const { google } = require('googleapis');

class SheetsService {
  constructor() {
    this.auth = null;
    this.sheets = null;
    this.initialize();
  }

  async initialize() {
    try {
      // Initialize Google Auth
      this.auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file'
        ],
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    } catch (error) {
      console.error('Error initializing Google Sheets service:', error);
      throw error;
    }
  }

  // Create a new spreadsheet for puja propositions
  async createPujaSpreadsheet(title, month, year) {
    try {
      const spreadsheetTitle = `${title} - ${month} ${year}`;
      
      const resource = {
        properties: {
          title: spreadsheetTitle
        },
        sheets: [
          {
            properties: {
              title: 'Puja Propositions',
              gridProperties: {
                rowCount: 100,
                columnCount: 15
              }
            }
          },
          {
            properties: {
              title: 'Feedback Tracker',
              gridProperties: {
                rowCount: 100,
                columnCount: 10
              }
            }
          },
          {
            properties: {
              title: 'Performance Data',
              gridProperties: {
                rowCount: 100,
                columnCount: 12
              }
            }
          }
        ]
      };

      const response = await this.sheets.spreadsheets.create({
        resource,
        fields: 'spreadsheetId,spreadsheetUrl'
      });

      const spreadsheetId = response.data.spreadsheetId;
      
      // Setup headers for each sheet
      await this.setupPujaPropositionHeaders(spreadsheetId);
      await this.setupFeedbackHeaders(spreadsheetId);
      await this.setupPerformanceHeaders(spreadsheetId);

      return {
        spreadsheetId: spreadsheetId,
        spreadsheetUrl: response.data.spreadsheetUrl,
        title: spreadsheetTitle
      };
    } catch (error) {
      console.error('Error creating spreadsheet:', error);
      throw error;
    }
  }

  async setupPujaPropositionHeaders(spreadsheetId) {
    const headers = [
      'Date',
      'Tithi',
      'Graha Transit',
      'Deity',
      'Puja Name',
      'Use Case',
      'Specificity',
      'Rationale',
      'Taglines',
      'Status',
      'Team Notes',
      'Approved By',
      'Campaign Live',
      'Performance Score',
      'Action Items'
    ];

    await this.updateRange(spreadsheetId, 'Puja Propositions!A1:O1', [headers]);
    
    // Format headers
    await this.formatHeaders(spreadsheetId, 'Puja Propositions', 'A1:O1');
  }

  async setupFeedbackHeaders(spreadsheetId) {
    const headers = [
      'Puja Name',
      'Date',
      'User Feedback',
      'Team Review',
      'Rating',
      'CTR',
      'Revenue',
      'Learnings',
      'Next Actions',
      'Updated Date'
    ];

    await this.updateRange(spreadsheetId, 'Feedback Tracker!A1:J1', [headers]);
    await this.formatHeaders(spreadsheetId, 'Feedback Tracker', 'A1:J1');
  }

  async setupPerformanceHeaders(spreadsheetId) {
    const headers = [
      'Month',
      'Puja Category',
      'Deity',
      'Total Campaigns',
      'Avg CTR',
      'Total Revenue',
      'User Satisfaction',
      'Top Performer',
      'Improvement Areas',
      'Next Month Strategy',
      'Experiments Planned',
      'Success Rate'
    ];

    await this.updateRange(spreadsheetId, 'Performance Data!A1:L1', [headers]);
    await this.formatHeaders(spreadsheetId, 'Performance Data', 'A1:L1');
  }

  async formatHeaders(spreadsheetId, sheetTitle, range) {
    try {
      const sheetId = await this.getSheetId(spreadsheetId, sheetTitle);
      
      const requests = [
        {
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: 0,
              endRowIndex: 1
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.2, green: 0.6, blue: 0.9 },
                textFormat: {
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                  fontSize: 12,
                  bold: true
                }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)'
          }
        }
      ];

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests }
      });
    } catch (error) {
      console.error('Error formatting headers:', error);
    }
  }

  async getSheetId(spreadsheetId, sheetTitle) {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties'
      });

      const sheet = response.data.sheets.find(s => s.properties.title === sheetTitle);
      return sheet ? sheet.properties.sheetId : 0;
    } catch (error) {
      console.error('Error getting sheet ID:', error);
      return 0;
    }
  }

  // Export puja propositions to spreadsheet
  async exportPujaPropositions(spreadsheetId, propositions) {
    try {
      const values = propositions.map(prop => [
        prop.date || '',
        prop.tithi || '',
        prop.grahaTransit || '',
        prop.deity || '',
        prop.pujaName || '',
        prop.useCase || '',
        prop.specificity || '',
        prop.rationale || '',
        prop.taglines ? prop.taglines.join('; ') : '',
        prop.status || 'Pending Review',
        '', // Team Notes
        '', // Approved By
        '', // Campaign Live
        '', // Performance Score
        ''  // Action Items
      ]);

      // Find the next empty row
      const nextRow = await this.getNextEmptyRow(spreadsheetId, 'Puja Propositions');
      const range = `Puja Propositions!A${nextRow}:O${nextRow + values.length - 1}`;

      await this.updateRange(spreadsheetId, range, values);

      return {
        success: true,
        rowsAdded: values.length,
        startRow: nextRow
      };
    } catch (error) {
      console.error('Error exporting propositions:', error);
      throw error;
    }
  }

  // Export feedback data
  async exportFeedbackData(spreadsheetId, feedbackData) {
    try {
      const values = feedbackData.map(feedback => [
        feedback.pujaName || '',
        feedback.date || '',
        feedback.userFeedback || '',
        feedback.teamReview || '',
        feedback.rating || '',
        feedback.ctr || '',
        feedback.revenue || '',
        feedback.learnings || '',
        feedback.nextActions || '',
        new Date().toISOString().split('T')[0]
      ]);

      const nextRow = await this.getNextEmptyRow(spreadsheetId, 'Feedback Tracker');
      const range = `Feedback Tracker!A${nextRow}:J${nextRow + values.length - 1}`;

      await this.updateRange(spreadsheetId, range, values);

      return {
        success: true,
        rowsAdded: values.length,
        startRow: nextRow
      };
    } catch (error) {
      console.error('Error exporting feedback:', error);
      throw error;
    }
  }

  // Update performance data
  async updatePerformanceData(spreadsheetId, performanceData) {
    try {
      const values = [[
        performanceData.month || '',
        performanceData.pujaCategory || '',
        performanceData.deity || '',
        performanceData.totalCampaigns || '',
        performanceData.avgCTR || '',
        performanceData.totalRevenue || '',
        performanceData.userSatisfaction || '',
        performanceData.topPerformer || '',
        performanceData.improvementAreas || '',
        performanceData.nextMonthStrategy || '',
        performanceData.experimentsPlanned || '',
        performanceData.successRate || ''
      ]];

      const nextRow = await this.getNextEmptyRow(spreadsheetId, 'Performance Data');
      const range = `Performance Data!A${nextRow}:L${nextRow}`;

      await this.updateRange(spreadsheetId, range, values);

      return {
        success: true,
        rowsAdded: 1,
        startRow: nextRow
      };
    } catch (error) {
      console.error('Error updating performance data:', error);
      throw error;
    }
  }

  // Read data from spreadsheet
  async readSpreadsheetData(spreadsheetId, sheetName, range = null) {
    try {
      const fullRange = range ? `${sheetName}!${range}` : sheetName;
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: fullRange
      });

      return {
        values: response.data.values || [],
        range: response.data.range
      };
    } catch (error) {
      console.error('Error reading spreadsheet data:', error);
      throw error;
    }
  }

  // Get team feedback from spreadsheet
  async getTeamFeedback(spreadsheetId) {
    try {
      const data = await this.readSpreadsheetData(spreadsheetId, 'Puja Propositions');
      
      if (!data.values || data.values.length <= 1) {
        return [];
      }

      const headers = data.values[0];
      const rows = data.values.slice(1);

      const feedback = rows.map(row => {
        const rowData = {};
        headers.forEach((header, index) => {
          rowData[header.toLowerCase().replace(/\s+/g, '_')] = row[index] || '';
        });
        return rowData;
      }).filter(row => row.status && row.status !== 'Pending Review');

      return feedback;
    } catch (error) {
      console.error('Error getting team feedback:', error);
      throw error;
    }
  }

  // Helper methods
  async updateRange(spreadsheetId, range, values) {
    return await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      resource: { values }
    });
  }

  async getNextEmptyRow(spreadsheetId, sheetName) {
    try {
      const data = await this.readSpreadsheetData(spreadsheetId, sheetName, 'A:A');
      return (data.values ? data.values.length : 0) + 1;
    } catch (error) {
      console.error('Error getting next empty row:', error);
      return 2; // Default to row 2 if error
    }
  }

  // Batch operations
  async batchUpdateCells(spreadsheetId, updates) {
    try {
      const requests = updates.map(update => ({
        updateCells: {
          range: update.range,
          rows: update.rows,
          fields: update.fields || 'userEnteredValue'
        }
      }));

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests }
      });

      return { success: true, updatesApplied: requests.length };
    } catch (error) {
      console.error('Error in batch update:', error);
      throw error;
    }
  }
}

module.exports = new SheetsService();