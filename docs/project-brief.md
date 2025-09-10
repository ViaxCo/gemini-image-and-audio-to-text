# Project Brief: Image-to-Text OCR App

## Executive Summary

This project aims to develop a simple web application that efficiently converts images of book pages into structured markdown text. It will leverage the Gemini API for robust OCR and the AI SDK 5 for seamless integration, allowing users to input images and a prompt to receive well-formatted text output that can be easily copied for various uses. The core value proposition is to streamline the personal digitization of book content, overcoming the inefficiencies of manual text extraction.

## Problem Statement

Manually converting large volumes of book page images into usable text is a highly time-consuming and often error-prone process. Existing generic OCR tools or AI chat interfaces may lack the specific features for streamlined image submission, parallel processing, and direct markdown output tailored for book content, leading to inefficiencies when digitizing personal libraries or research materials. The absence of an integrated solution that combines robust AI OCR with a user-friendly, batch-processing interface creates a significant pain point for individuals seeking to digitize textual content from books.

## Proposed Solution

The proposed solution is a web application featuring a distinct two-column layout. The left column will serve as the input interface for uploading book page images (via drag-and-drop or a button) and entering a custom prompt. The right column will dynamically display multiple "request cards," each representing an image-to-text conversion job processing in parallel. Each card will show the processing status and, upon completion, present the markdown-formatted text output. Users will be able to directly copy the output from the card, expand it into a modal for full review, or retry the request if dissatisfied with the results. This approach prioritizes efficiency, user control, and accurate markdown output tailored for book content.

## Target Users

### Primary User Segment: Individual User

The primary user is an individual (yourself) who needs an efficient and accurate method for converting physical book pages into digital, editable text. This user values ease of use, responsiveness, the ability to process multiple pages, and high-quality markdown output with specific formatting instructions for paragraphs, page numbers, and exclusion of irrelevant metadata.

## Goals & Success Metrics

### Business Objectives
- Efficiently digitize personal book collection content.
- Reduce time and effort traditionally required for manual text extraction.

### User Success Metrics
- High accuracy of text extraction from book page images.
- Fast processing and retrieval of markdown output.
- Seamless ability to copy formatted text.
- Responsive UI that supports parallel processing of multiple pages.

### Key Performance Indicators (KPIs)
- **OCR Accuracy Rate:** Qualitative assessment of extracted text fidelity.
- **Processing Time per Page:** (Internal metric) Time taken from submission to result display for an average page.
- **Pages Processed per Session:** Average number of book pages processed in a single user session.

## MVP Scope

### Core Features (Must Have)
- **Image Upload Interface:** A left-column interface allowing users to upload book page images (JPEG, JPG, PNG) via drag-and-drop or a file upload button.
- **Prompt Input Field:** An accompanying text area in the left column for users to input custom instructions for the Gemini API.
- **Request Submission:** A clear action to send the uploaded images and prompt to the backend for processing.
- **Right-Column Request Cards:** A dynamic right-column display where each submitted request appears as an individual card, showing its current processing status (e.g., "Processing," "Complete," "Failed").
- **Copy Markdown Output:** A button on each completed request card to directly copy the extracted markdown text to the clipboard.
- **Expand to Full View Modal:** A button on each card to open a modal window displaying the full extracted markdown text for detailed review.
- **Retry Request Functionality:** A button on each card to re-send the original images and prompt to the Gemini API for re-processing.
- **Backend Integration:** Server-side logic to receive image/prompt, interact with the Gemini API (using AI SDK 5), perform OCR, process output according to prompt instructions (paragraph arrangement, page number addition, metadata removal), and return markdown text.
- **Asynchronous Processing (High-Level):** Backend designed to handle requests in a non-blocking manner, supporting multiple concurrent processing tasks.
- **Markdown Output Formatting:** Gemini API output processed to ensure text is arranged in paragraphs, includes page numbers, and excludes specified irrelevant metadata.

### Out of Scope for MVP
- Video or GIF processing.
- User authentication or multi-user features.
- Advanced in-app text editing capabilities beyond simple viewing.
- Complex text formatting options beyond markdown paragraphs and basic styling.
- Long-term storage of extracted text (temporary availability until copied is sufficient for MVP).

### MVP Success Criteria
- Successful and accurate conversion of single book page images to well-formatted markdown text, adhering to user-defined prompt instructions (paragraphs, page numbers, metadata removal).
- A responsive user interface capable of initiating and displaying the status of multiple parallel image-to-text conversion requests.
- Easy and reliable copying of the markdown output to the clipboard from both card and expanded modal views.
- Functional "Retry Request" mechanism.

## Post-MVP Vision

### Phase 2 Features
- **Batch Processing:** Ability to upload multiple images (e.g., an entire chapter) as a single request, with intelligent processing and output merging.
- **Integrated Text Editing:** Basic in-app markdown editing capabilities for minor corrections or refinements post-OCR.
- **User Accounts & Session Management:** For managing historical requests and outputs across sessions (if it evolves beyond a personal tool).

### Long-term Vision
The long-term vision is a highly efficient and intelligent personal digitization and content extraction tool for books. It could evolve to offer advanced document analysis, structured data extraction, and more sophisticated output formats.

### Expansion Opportunities
- Integration with cloud storage services (e.g., Google Drive, Dropbox) for image input and text output.
- Advanced image pre-processing (e.g., de-skewing, contrast enhancement) before sending to Gemini API.
- Export options to various formats like PDF, EPUB, or specific research note-taking applications.

## Technical Considerations

### Platform Requirements
- **Target Platforms:** Web Responsive (browser-based application).

### Technology Preferences
- **Frontend:** (To be determined, but focused on responsive web development)
- **Backend:** (To be determined, likely Node.js or Python for AI SDK 5 integration)
- **Database:** (Minimal or temporary storage for request state/results for MVP)
- **AI API:** Gemini API.
- **AI SDK:** AI SDK 5.

### Architecture Considerations
- **Repository Structure:** (To be determined, potentially a monorepo for tightly coupled frontend/backend).
- **Service Architecture:** Client-side request management with an asynchronous backend for processing Gemini API calls.
- **Integration Requirements:** Real-time updates for request cards (e.g., WebSockets or efficient polling).
- **Security/Compliance:** Basic API key handling and data privacy appropriate for a personal tool.

## Constraints & Assumptions

### Constraints
- **Budget:** None (personal project).
- **Timeline:** None (personal project).
- **Resources:** Limited to individual development effort.

### Key Assumptions
- Gemini API's OCR capabilities are sufficiently accurate for book page images, even with variations in lighting and resolution.
- AI SDK 5 provides robust and easy-to-use tooling for integrating with the Gemini API.
- Markdown output from Gemini API can be reliably parsed and formatted according to prompt instructions.
- The user is comfortable providing explicit prompt instructions for desired output formatting.

## Risks & Open Questions

### Key Risks
- **Gemini API Rate Limits:** Potential issue if too many parallel requests are sent without proper throttling/queue management.
- **OCR Accuracy for Edge Cases:** Images with very poor quality, unusual fonts, or complex layouts might lead to suboptimal extraction, requiring multiple retries.
- **Complexity of Real-time Updates:** Implementing robust real-time communication (e.g., WebSockets) for status updates can add complexity.

### Open Questions
- **Exact Markdown Nuances:** Beyond paragraphs and page numbers, are there specific markdown elements (e.g., headings, bolding, lists) that are critically important for the extracted text?
- **Long-term Storage:** Is temporary result availability until copied sufficient, or should there be an option for more persistent storage within the app for past conversions?
