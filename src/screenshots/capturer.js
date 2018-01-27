import { join as joinPath, dirname } from 'path';
import sanitizeFilename from 'sanitize-filename';
import { generateThumbnail } from 'testcafe-browser-tools';
import { ensureDir } from '../utils/promisified-functions';


const PNG_EXTENSION_RE = /(\.png)$/;


export default class Capturer {
    constructor (baseScreenshotsPath, testEntry, connection, namingOptions) {
        this.enabled              = !!baseScreenshotsPath;
        this.baseScreenshotsPath  = baseScreenshotsPath;
        this.testEntry            = testEntry;
        this.provider             = connection.provider;
        this.browserId            = connection.id;
        this.quarantineAttemptNum = namingOptions.quarantineAttemptNum;
        this.testIndex            = namingOptions.testIndex;
        this.screenshotIndex      = 1;
        this.errorScreenshotIndex = 1;

        var screenshotsPath = this.enabled ? this.baseScreenshotsPath : '';

        this.screenshotsPath         = screenshotsPath;
        this.screenshotPathForReport = screenshotsPath;
        this.screenshotsPatternName  = namingOptions.patternName;

        this.patternMap = namingOptions.patternMap;
    }

    static _correctFilePath (path) {
        var correctedPath = path
            .replace(/\\/g, '/')
            .split('/')
            .map(str => sanitizeFilename(str))
            .join('/');

        return PNG_EXTENSION_RE.test(correctedPath) ? correctedPath : `${correctedPath}.png`;
    }

    _parseFileNumber (fileName) {
        if (fileName.indexOf('%FILENUMBER%') !== -1)
            return fileName.replace(new RegExp('%FILENUMBER%', 'g'), (this.screenshotIndex - 1).toString().padStart(3, 0));

        return fileName;
    }

    _getFileName (forError) {
        let fileName = '';

        if (this.screenshotsPatternName)
            fileName = `${this.screenshotsPatternName}.png`;
        else
            fileName = `${forError ? this.errorScreenshotIndex : this.screenshotIndex}.png`;

        if (forError)
            this.errorScreenshotIndex++;
        else
            this.screenshotIndex++;

        return fileName;
    }

    _parsePattern (namePattern) {
        for (const pattern in this.patternMap)
            namePattern = namePattern.replace(new RegExp(`%${pattern}%`, 'g'), this.patternMap[pattern]);

        return namePattern;
    }

    _getSreenshotPath (fileName, customPath) {
        if (customPath)
            return joinPath(this.baseScreenshotsPath, Capturer._correctFilePath(this._parsePattern(customPath)));

        var screenshotPath = this.quarantineAttemptNum !== null ?
            joinPath(this.screenshotsPath, `run-${this.quarantineAttemptNum}`) :
            this.screenshotsPath;

        return joinPath(screenshotPath, fileName);
    }

    async _takeScreenshot (filePath, pageWidth, pageHeight) {
        await ensureDir(dirname(filePath));
        await this.provider.takeScreenshot(this.browserId, filePath, pageWidth, pageHeight);
    }

    async _capture (forError, pageWidth, pageHeight, customScreenshotPath) {
        if (!this.enabled)
            return null;

        var fileName = this._parseFileNumber(this._getFileName(forError));

        fileName = forError ? joinPath('errors', fileName) : fileName;

        var screenshotPath = this._getSreenshotPath(fileName, customScreenshotPath);

        await this._takeScreenshot(screenshotPath, pageWidth, pageHeight);
        await generateThumbnail(screenshotPath);

        // NOTE: if test contains takeScreenshot action with custom path
        // we should specify the most common screenshot folder in report
        if (customScreenshotPath)
            this.screenshotPathForReport = this.baseScreenshotsPath;

        this.testEntry.hasScreenshots = true;
        this.testEntry.path           = this.screenshotPathForReport;

        return screenshotPath;
    }


    async captureAction ({ pageWidth, pageHeight, customPath }) {
        return await this._capture(false, pageWidth, pageHeight, customPath);
    }

    async captureError ({ pageWidth, pageHeight }) {
        return await this._capture(true, pageWidth, pageHeight);
    }
}

