I would like to create a WordPress Plugin from an uploaded `Features List.json` JSON file. The file primarily contains details about the VAPT Vulnerabilities and Tests to perform and Check if the Webiste is protected against the Vulnerabilities. The plugin must adhere to the WordPress Coding Standards and follow the Best Practices as being practices in the industry.

I need the plugin to have three Sub-Menus VAPT Master Dashboard, VAPT Workbench, Client Admin Dashboard.

VAPT Master Dashboard and VAPT Workbench, will only be visible to a Superadmin user `tanmalik786`, email `tanmalik786@gmail.com` should be validated by an email OTP BUT could be skipped on the localhost to avoid any Inconveniences. Each selected feature will have a Status of Draft, and will Transition through these lifecycle steps/statusses Build, Test and Release. Both of these Menu items will only be visible to this Superadmin user, and shall remain hidden from the Website Admins and could be access using a special URL.

VAPT Master Dashboard, will consist of a header section - containing things related to JSON file uploading, hiding the other uploaded files, Displaying a summary of things like Feature Count, Count of Features at states like Draft, Build, Test, Release

and four tabs structure - as described below
1. Feature List - will display all the feature as defined in the uploaded JSON file with columns like Feature Name, Category, Severity, Description, Lifecycle Status, Released Date, Includes.
2. License Management - Standard [30 Days, Pro One Year and Developer Perpetual], will be tied to the selected domain.
3. Domain Features - Here Superadmin will pick and chose which of the Features with a Status of `Release`, will actually be released to this Domain [License Domain].
4. Build Generator - this tab will be used to actually create a new plugin for release to the Site Owner - with some white label features for the Plugin Header BUT tied to the selected domain and will offer only the features released for this domain.

The `Include` column will contain Toggle's like Include Test `tests` to include the steps the end user can adopt to verify, 


Can you analyze for first 5 features and suggest me a plan as to how we can use this JSON file to create an "AI Design Prompt", which when shared a AI Agent, helps it creates a JSON Schema to Create Functional Implementation and a Corresponding Verification Implementation to use as an evidence that the Functional Implementation Actually Works?