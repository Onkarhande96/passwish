import os
import sys
import json
import base64
import datetime
import tkinter as tk
from tkinter import ttk, messagebox

# Import core license signing logic
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from license_manager import MASTER_SALT, create_license_signature

EXCEL_REGISTER_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Customer_Licenses_Register.xlsx")

def log_license_to_excel(client_name, machine_id, validity_desc, expiry_str, license_key):
    """
    Appends the issued license details to Customer_Licenses_Register.xlsx
    with professional headers, formatting, and auto-adjusted column widths.
    """
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

        headers = [
            "Sr No", "Date Issued", "Client / Agency Name", "Machine ID", 
            "Validity", "Expiry Date", "Generated License Key", "Status"
        ]

        file_exists = os.path.exists(EXCEL_REGISTER_FILE)
        if file_exists:
            try:
                wb = openpyxl.load_workbook(EXCEL_REGISTER_FILE)
                ws = wb.active
            except Exception:
                wb = openpyxl.Workbook()
                ws = wb.active
                ws.title = "Customer Licenses"
                file_exists = False
        else:
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Customer Licenses"

        if not file_exists or (ws.max_row == 1 and ws.cell(1, 1).value is None):
            # Clean and add styled headers
            header_fill = PatternFill(start_color="18181B", end_color="18181B", fill_type="solid")
            header_font = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
            header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)

            ws.append(headers)
            for col_num in range(1, len(headers) + 1):
                cell = ws.cell(row=1, column=col_num)
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = header_align
            ws.row_dimensions[1].height = 26

        # Determine next Sr No
        sr_no = max(1, ws.max_row)

        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        row_data = [
            sr_no, now_str, client_name, machine_id, validity_desc, expiry_str, license_key, "Active"
        ]
        ws.append(row_data)

        # Style data row
        thin_border = Border(
            left=Side(style='thin', color='E4E4E7'),
            right=Side(style='thin', color='E4E4E7'),
            top=Side(style='thin', color='E4E4E7'),
            bottom=Side(style='thin', color='E4E4E7')
        )
        current_row = ws.max_row
        ws.row_dimensions[current_row].height = 22

        for col_num in range(1, len(row_data) + 1):
            cell = ws.cell(row=current_row, column=col_num)
            cell.font = Font(name="Segoe UI", size=9)
            cell.border = thin_border
            if col_num in [1, 2, 4, 6, 8]:
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")
            
            # Highlight status column in soft green
            if col_num == 8:
                cell.fill = PatternFill(start_color="ECFDF5", end_color="ECFDF5", fill_type="solid")
                cell.font = Font(name="Segoe UI", size=9, bold=True, color="047857")

        # Auto-adjust column widths
        column_widths = {
            'A': 8,   # Sr No
            'B': 20,  # Date Issued
            'C': 26,  # Client Name
            'D': 28,  # Machine ID
            'E': 18,  # Validity
            'F': 16,  # Expiry Date
            'G': 42,  # License Key
            'H': 12   # Status
        }
        for col_letter, width in column_widths.items():
            ws.column_dimensions[col_letter].width = width

        wb.save(EXCEL_REGISTER_FILE)
        return True
    except Exception as e:
        print(f"[Warning] Could not log to Excel: {e}")
        return False

def generate_key_string(client_name, machine_id, expiry_str):
    client_name = client_name.strip() or "Valued Client"
    machine_id = machine_id.strip().upper()

    payload_dict = {
        "client_name": client_name,
        "machine_id": machine_id,
        "expiry": expiry_str,
        "issued_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    payload_json = json.dumps(payload_dict, separators=(',', ':'))
    payload_bytes = payload_json.encode('utf-8')
    payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode('utf-8')

    signature = create_license_signature(payload_bytes)
    return f"LIC-{payload_b64}.{signature}"

class LicenseGeneratorApp:
    def __init__(self, root):
        self.root = root
        self.root.title("PassWish — Commercial License Generator (Developer Only)")
        self.root.geometry("640x560")
        self.root.resizable(False, False)
        self.root.configure(bg="#f4f4f5")

        self.setup_ui()

    def setup_ui(self):
        # Header Frame
        header = tk.Frame(self.root, bg="#18181b", height=70)
        header.pack(fill="x")

        title_lbl = tk.Label(
            header,
            text="PassWish Commercial License Studio",
            font=("Segoe UI", 15, "bold"),
            fg="#ffffff",
            bg="#18181b"
        )
        title_lbl.pack(anchor="w", padx=20, pady=(12, 2))

        sub_lbl = tk.Label(
            header,
            text="Generate Hardware-Locked Activation Keys & Auto-Save Customer Records",
            font=("Segoe UI", 9),
            fg="#a1a1aa",
            bg="#18181b"
        )
        sub_lbl.pack(anchor="w", padx=20, pady=(0, 12))

        # Main Body Container
        body = tk.Frame(self.root, bg="#f4f4f5", padx=24, pady=16)
        body.pack(fill="both", expand=True)

        # 1. Client Name
        lbl1 = tk.Label(body, text="Client / Agency Name:", font=("Segoe UI", 9, "bold"), fg="#27272a", bg="#f4f4f5")
        lbl1.pack(anchor="w", pady=(4, 2))

        self.name_var = tk.StringVar()
        name_entry = tk.Entry(body, textvariable=self.name_var, font=("Segoe UI", 10), bg="#ffffff", relief="solid", bd=1)
        name_entry.pack(fill="x", ipady=5, pady=(0, 10))

        # 2. Machine ID with Paste Button
        lbl2 = tk.Label(body, text="Customer Machine ID (from activation screen):", font=("Segoe UI", 9, "bold"), fg="#27272a", bg="#f4f4f5")
        lbl2.pack(anchor="w", pady=(0, 2))

        mid_frame = tk.Frame(body, bg="#f4f4f5")
        mid_frame.pack(fill="x", pady=(0, 10))

        self.mid_var = tk.StringVar()
        self.mid_entry = tk.Entry(mid_frame, textvariable=self.mid_var, font=("Consolas", 10, "bold"), bg="#ffffff", relief="solid", bd=1)
        self.mid_entry.pack(side="left", fill="x", expand=True, ipady=5)

        paste_btn = tk.Button(
            mid_frame,
            text="📋 Paste",
            font=("Segoe UI", 9, "bold"),
            bg="#e4e4e7",
            fg="#18181b",
            relief="flat",
            padx=12,
            pady=3,
            command=self.paste_mid,
            cursor="hand2"
        )
        paste_btn.pack(side="right", padx=(8, 0))

        # 3. Validity Selection
        lbl3 = tk.Label(body, text="License Validity Period:", font=("Segoe UI", 9, "bold"), fg="#27272a", bg="#f4f4f5")
        lbl3.pack(anchor="w", pady=(0, 2))

        self.validity_options = [
            "1 Year (365 Days) — Recommended",
            "Lifetime (Permanent / Unlimited)",
            "2 Years (730 Days)",
            "6 Months (180 Days)",
            "30 Days (Demo / Trial)"
        ]
        self.validity_var = tk.StringVar(value=self.validity_options[0])
        validity_combo = ttk.Combobox(body, textvariable=self.validity_var, values=self.validity_options, state="readonly", font=("Segoe UI", 10))
        validity_combo.pack(fill="x", ipady=4, pady=(0, 16))

        # 4. Generate Button
        gen_btn = tk.Button(
            body,
            text="🚀 Generate Activation Key & Save to Excel",
            font=("Segoe UI", 11, "bold"),
            bg="#059669",
            fg="#ffffff",
            activebackground="#047857",
            activeforeground="#ffffff",
            relief="flat",
            cursor="hand2",
            pady=8,
            command=self.generate_key
        )
        gen_btn.pack(fill="x", pady=(0, 12))

        # 5. Output Area
        lbl4 = tk.Label(body, text="Generated License Key (Ready to send to client):", font=("Segoe UI", 9, "bold"), fg="#27272a", bg="#f4f4f5")
        lbl4.pack(anchor="w", pady=(0, 2))

        self.output_text = tk.Text(body, height=3, font=("Consolas", 9), bg="#ffffff", relief="solid", bd=1, wrap="char")
        self.output_text.pack(fill="x", pady=(0, 8))

        # 6. Action Buttons & Status
        action_frame = tk.Frame(body, bg="#f4f4f5")
        action_frame.pack(fill="x", pady=(2, 0))

        self.copy_btn = tk.Button(
            action_frame,
            text="📋 Copy Key to Clipboard",
            font=("Segoe UI", 9, "bold"),
            bg="#18181b",
            fg="#ffffff",
            relief="flat",
            cursor="hand2",
            padx=14,
            pady=6,
            command=self.copy_key
        )
        self.copy_btn.pack(side="left")

        self.excel_btn = tk.Button(
            action_frame,
            text="📂 Open Customer Licenses Excel",
            font=("Segoe UI", 9, "bold"),
            bg="#2563eb",
            fg="#ffffff",
            activebackground="#1d4ed8",
            activeforeground="#ffffff",
            relief="flat",
            cursor="hand2",
            padx=14,
            pady=6,
            command=self.open_excel
        )
        self.excel_btn.pack(side="left", padx=(8, 0))

        # Status message
        self.status_lbl = tk.Label(body, text="", font=("Segoe UI", 9, "bold"), fg="#059669", bg="#f4f4f5")
        self.status_lbl.pack(anchor="w", pady=(8, 0))

    def paste_mid(self):
        try:
            clipboard = self.root.clipboard_get().strip()
            self.mid_var.set(clipboard)
            self.status_lbl.config(text="Machine ID pasted from clipboard ✓", fg="#059669")
        except Exception:
            pass

    def generate_key(self):
        name = self.name_var.get().strip() or "Valued Client"
        mid = self.mid_var.get().strip().upper()

        if not mid:
            messagebox.showerror("Error", "Please enter or paste the customer's Machine ID!")
            return

        if not mid.startswith("PW-"):
            if not messagebox.askyesno("Warning", "The Machine ID usually starts with 'PW-'. Do you want to continue anyway?"):
                return

        choice = self.validity_var.get()
        today = datetime.date.today()

        if "Lifetime" in choice:
            exp_str = "LIFETIME"
            validity_simple = "Lifetime"
        elif "2 Years" in choice:
            exp_str = (today + datetime.timedelta(days=730)).strftime("%Y-%m-%d")
            validity_simple = "2 Years"
        elif "6 Months" in choice:
            exp_str = (today + datetime.timedelta(days=180)).strftime("%Y-%m-%d")
            validity_simple = "6 Months"
        elif "30 Days" in choice:
            exp_str = (today + datetime.timedelta(days=30)).strftime("%Y-%m-%d")
            validity_simple = "30 Days"
        else: # 1 Year
            exp_str = (today + datetime.timedelta(days=365)).strftime("%Y-%m-%d")
            validity_simple = "1 Year"

        key = generate_key_string(name, mid, exp_str)

        self.output_text.delete("1.0", tk.END)
        self.output_text.insert(tk.END, key)

        # Auto-copy to clipboard
        self.root.clipboard_clear()
        self.root.clipboard_append(key)

        # Auto-save to Excel Register
        saved = log_license_to_excel(name, mid, validity_simple, exp_str, key)

        if saved:
            self.status_lbl.config(
                text="✓ Key generated, copied & recorded in 'Customer_Licenses_Register.xlsx'!",
                fg="#059669"
            )
        else:
            self.status_lbl.config(
                text="✓ Key generated & copied to clipboard! (Please close Excel if open to save)",
                fg="#059669"
            )

    def copy_key(self):
        key = self.output_text.get("1.0", tk.END).strip()
        if not key:
            messagebox.showinfo("Notice", "Please generate a key first.")
            return
        self.root.clipboard_clear()
        self.root.clipboard_append(key)
        self.status_lbl.config(text="✓ Copied to clipboard! Ready to paste in WhatsApp.", fg="#059669")

    def open_excel(self):
        if os.path.exists(EXCEL_REGISTER_FILE):
            try:
                os.startfile(EXCEL_REGISTER_FILE)
            except Exception as e:
                messagebox.showerror("Error", f"Could not open Excel file: {e}")
        else:
            messagebox.showinfo(
                "Notice",
                "Customer_Licenses_Register.xlsx will be automatically created as soon as you generate your first key."
            )

if __name__ == '__main__':
    root = tk.Tk()
    app = LicenseGeneratorApp(root)
    root.mainloop()
