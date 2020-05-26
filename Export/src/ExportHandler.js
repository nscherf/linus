import { default as FileSaver } from "../includes/FileSaver.min.js";

export default class ExportHandler {

    /**
     * Create a custom date string
     */
    getExportFileName() {
        let date = new Date();
        var dateString =
            date.getFullYear() +
            "-" +
            (1 + date.getMonth()) +
            "-" +
            date.getDate() +
            "--" +
            date.getHours() +
            "-" +
            ("00" + date.getMinutes()).slice(-2) +
            "-" +
            date.getSeconds();

        return dateString;
    }

    /**
     * Download of plain text
     */
    downloadText(filename, text) {
        var blob = new File([text], "data.json", {
            type: "text/plain;charset=utf-8",
        });
        FileSaver.saveAs(blob, filename);
    }

    /**
     * Plain download of any data
     */
    downloadRaw(filename, content) {
        FileSaver.saveAs(content, filename);
    }
}