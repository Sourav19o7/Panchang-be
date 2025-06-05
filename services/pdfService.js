const fs = require('fs').promises;
const path = require('path');
const pdf = require('pdf-parse');

class PDFService {
  constructor() {
    this.resourcesPath = path.join(__dirname, '../resources/pdfs');
  }

  async extractTextFromPDF(filename) {
    try {
      const filePath = path.join(this.resourcesPath, filename);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (error) {
        throw new Error(`PDF file not found: ${filename}`);
      }

      // Read and parse PDF
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdf(dataBuffer);
      
      return {
        text: data.text,
        info: data.info,
        metadata: data.metadata,
        numPages: data.numpages,
        filename: filename
      };
    } catch (error) {
      console.error('Error extracting PDF text:', error);
      throw new Error(`Failed to extract text from PDF ${filename}: ${error.message}`);
    }
  }

  async extractTextFromMultiplePDFs(filenames) {
    try {
      const results = [];
      for (const filename of filenames) {
        const result = await this.extractTextFromPDF(filename);
        results.push(result);
      }
      return results;
    } catch (error) {
      console.error('Error extracting multiple PDFs:', error);
      throw error;
    }
  }

  async listAvailablePDFs() {
    try {
      const files = await fs.readdir(this.resourcesPath);
      return files.filter(file => path.extname(file).toLowerCase() === '.pdf');
    } catch (error) {
      console.error('Error listing PDFs:', error);
      return [];
    }
  }

  async savePDF(buffer, filename) {
    try {
      // Ensure filename has .pdf extension
      if (!filename.endsWith('.pdf')) {
        filename += '.pdf';
      }

      const filePath = path.join(this.resourcesPath, filename);
      
      // Ensure directory exists
      await fs.mkdir(this.resourcesPath, { recursive: true });
      
      // Save file
      await fs.writeFile(filePath, buffer);
      
      return {
        success: true,
        filename: filename,
        path: filePath
      };
    } catch (error) {
      console.error('Error saving PDF:', error);
      throw new Error(`Failed to save PDF: ${error.message}`);
    }
  }

  async deletePDF(filename) {
    try {
      const filePath = path.join(this.resourcesPath, filename);
      await fs.unlink(filePath);
      return { success: true, message: `PDF ${filename} deleted successfully` };
    } catch (error) {
      console.error('Error deleting PDF:', error);
      throw new Error(`Failed to delete PDF ${filename}: ${error.message}`);
    }
  }

  async getPDFInfo(filename) {
    try {
      const filePath = path.join(this.resourcesPath, filename);
      const stats = await fs.stat(filePath);
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdf(dataBuffer);

      return {
        filename: filename,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        pages: data.numpages,
        info: data.info,
        metadata: data.metadata
      };
    } catch (error) {
      console.error('Error getting PDF info:', error);
      throw new Error(`Failed to get PDF info for ${filename}: ${error.message}`);
    }
  }

  // Method specifically for gemini service
  formatPDFContentForAI(pdfResults) {
    if (!Array.isArray(pdfResults)) {
      pdfResults = [pdfResults];
    }

    return pdfResults.map(result => {
      return `
--- Document: ${result.filename} (${result.numPages} pages) ---
${result.text}
--- End of ${result.filename} ---
`;
    }).join('\n\n');
  }

  // Search within PDF content
  async searchInPDF(filename, searchTerm) {
    try {
      const pdfData = await this.extractTextFromPDF(filename);
      const text = pdfData.text.toLowerCase();
      const term = searchTerm.toLowerCase();
      
      const matches = [];
      let index = text.indexOf(term);
      
      while (index !== -1) {
        // Get context around the match (50 characters before and after)
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + term.length + 50);
        const context = text.substring(start, end);
        
        matches.push({
          position: index,
          context: context,
          page: this.estimatePageNumber(text, index, pdfData.numPages)
        });
        
        index = text.indexOf(term, index + 1);
      }
      
      return {
        filename: filename,
        searchTerm: searchTerm,
        matches: matches,
        totalMatches: matches.length
      };
    } catch (error) {
      console.error('Error searching in PDF:', error);
      throw error;
    }
  }

  // Helper method to estimate page number
  estimatePageNumber(text, position, totalPages) {
    const textLength = text.length;
    const estimatedPage = Math.ceil((position / textLength) * totalPages);
    return estimatedPage;
  }
}

// Export both the class and convenience functions
const pdfService = new PDFService();

module.exports = {
  PDFService,
  extractTextFromPDF: (filename) => pdfService.extractTextFromPDF(filename),
  extractTextFromMultiplePDFs: (filenames) => pdfService.extractTextFromMultiplePDFs(filenames),
  listAvailablePDFs: () => pdfService.listAvailablePDFs(),
  savePDF: (buffer, filename) => pdfService.savePDF(buffer, filename),
  deletePDF: (filename) => pdfService.deletePDF(filename),
  getPDFInfo: (filename) => pdfService.getPDFInfo(filename),
  searchInPDF: (filename, searchTerm) => pdfService.searchInPDF(filename, searchTerm),
  formatPDFContentForAI: (pdfResults) => pdfService.formatPDFContentForAI(pdfResults),
  pdfService
};