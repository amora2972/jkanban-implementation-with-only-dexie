import {ITicket} from './interfaces/ticket.interface';

export class Ticket implements ITicket {
  id?: any;
  title: string;
  originalTitle?: string;
  columnId: any;
  order: number;
  image?: Blob;


  constructor(ticket?: ITicket) {
    if (ticket) {
      this.id = ticket.id || null;
      this.title = ticket.title;
      this.columnId = ticket.columnId;
      this.order = ticket.order;
    }
  }
}

